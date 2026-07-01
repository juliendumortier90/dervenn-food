#!/usr/bin/env python3
import argparse
import base64
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any


DEFAULT_TABLE_NAME = "dervenn-invitation-guests"
DEFAULT_STATUS_TABLE_NAME = "dervenn-invitation-statuses"
DEFAULT_REGION = "eu-west-3"
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_CONTACT_STATUS = "non_contacte"
DEFAULT_ATTENDANCE_STATUS = "pas_repondu"

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F1E6-\U0001F1FF"
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U00002600-\U000026FF"
    "\U0000FE00-\U0000FE0F"
    "\U0001F3FB-\U0001F3FF"
    "]+",
    flags=re.UNICODE,
)
WHITESPACE_PATTERN = re.compile(r"\s+")


def clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""

    without_emoji = EMOJI_PATTERN.sub("", value)
    return WHITESPACE_PATTERN.sub(" ", without_emoji).strip()


def read_instagram_export(path: str) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as json_file:
        data = json.load(json_file)

    if not isinstance(data, list):
        raise ValueError("Le fichier JSON doit contenir un tableau d'utilisateurs Instagram")

    return data


def download_profile_picture_base64(url: str, timeout_seconds: int) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 dervenn-instagram-import/1.0",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )

    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        content_type = response.headers.get("Content-Type") or "image/jpeg"
        image_bytes = response.read()

    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def build_item(user: dict[str, Any], index: int, total_count: int, timeout_seconds: int) -> dict[str, str] | None:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    username = clean_text(user.get("username"))
    full_name = clean_text(user.get("full_name"))
    profile_pic_url = user.get("profile_pic_url")

    if not username:
        print(f"[skip] ligne {index}: username vide", file=sys.stderr)
        return None

    if not full_name:
        full_name = username

    if not isinstance(profile_pic_url, str) or not profile_pic_url.strip():
        print(f"[skip] @{username}: profile_pic_url vide", file=sys.stderr)
        return None

    print(f"[image] {index}/{total_count} @{username}")
    profile_picture_base64 = download_profile_picture_base64(profile_pic_url, timeout_seconds)

    return {
        "username": username,
        "fullName": full_name,
        "profilePictureBase64": profile_picture_base64,
        "createdAt": now,
        "updatedAt": now,
    }


def to_dynamodb_item(item: dict[str, str]) -> dict[str, Any]:
    return {
        "username": {"S": item["username"]},
        "fullName": {"S": item["fullName"]},
        "profilePictureBase64": {"S": item["profilePictureBase64"]},
        "createdAt": {"S": item["createdAt"]},
        "updatedAt": {"S": item["updatedAt"]},
    }


def put_item(table_name: str, item: dict[str, str], region: str, profile: str | None) -> None:
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".json", delete=True) as item_file:
        json.dump(to_dynamodb_item(item), item_file)
        item_file.flush()

        command = [
            "aws",
            "dynamodb",
            "put-item",
            "--table-name",
            table_name,
            "--item",
            f"file://{item_file.name}",
            "--region",
            region,
        ]
        if profile:
            command.extend(["--profile", profile])

        subprocess.run(command, check=True)


def to_dynamodb_status_item(username: str, edition_id: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "invitationId": {"S": f"{username}#{edition_id}"},
        "username": {"S": username},
        "editionId": {"S": edition_id},
        "contactStatus": {"S": DEFAULT_CONTACT_STATUS},
        "attendanceStatus": {"S": DEFAULT_ATTENDANCE_STATUS},
        "createdAt": {"S": now},
        "updatedAt": {"S": now},
    }


def put_status_item(table_name: str, username: str, edition_id: str, region: str, profile: str | None) -> None:
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".json", delete=True) as item_file:
        json.dump(to_dynamodb_status_item(username, edition_id), item_file)
        item_file.flush()

        command = [
            "aws",
            "dynamodb",
            "put-item",
            "--table-name",
            table_name,
            "--item",
            f"file://{item_file.name}",
            "--condition-expression",
            "attribute_not_exists(invitationId)",
            "--region",
            region,
        ]
        if profile:
            command.extend(["--profile", profile])

        result = subprocess.run(command, text=True, capture_output=True)

    if result.returncode == 0:
        return

    if "ConditionalCheckFailedException" in result.stderr:
        print(f"[status] @{username}: status deja existant pour l'edition {edition_id}")
        return

    raise subprocess.CalledProcessError(result.returncode, command, output=result.stdout, stderr=result.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Importe un export JSON Instagram dans la table DynamoDB des invites."
    )
    parser.add_argument("json_file", help="Chemin du fichier JSON Instagram a importer")
    parser.add_argument("--table", default=DEFAULT_TABLE_NAME)
    parser.add_argument("--status-table", default=DEFAULT_STATUS_TABLE_NAME)
    parser.add_argument("--edition-id", help="Cree aussi le status par defaut username#editionId pour cette edition")
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--profile")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--delay", type=float, default=0.1, help="Pause en secondes entre deux telechargements")
    parser.add_argument("--dry-run", action="store_true", help="Prepare les donnees sans ecrire dans DynamoDB")
    args = parser.parse_args()

    users = read_instagram_export(args.json_file)
    imported_count = 0
    skipped_count = 0
    total_count = len(users)

    for index, user in enumerate(users, start=1):
        item = build_item(user, index, total_count, args.timeout)

        if not item:
            skipped_count += 1
            continue

        if args.dry_run:
            print(f"[dry-run] @{item['username']} pret pour {args.table}")
        else:
            put_item(args.table, item, args.region, args.profile)
            print(f"[dynamodb] {index}/{total_count} @{item['username']} ecrit")

            if args.edition_id:
                put_status_item(args.status_table, item["username"], args.edition_id, args.region, args.profile)
                print(f"[status] @{item['username']} initialise pour l'edition {args.edition_id}")

        imported_count += 1

        if args.delay > 0:
            time.sleep(args.delay)

    action = "prepares" if args.dry_run else "ecrits"
    print(f"Import termine: {imported_count} invites {action} dans {args.table}, {skipped_count} ignores")


if __name__ == "__main__":
    main()
