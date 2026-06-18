#!/usr/bin/env python3
import argparse
import json
import subprocess
import uuid


DEFAULT_TABLE_NAME = "dervenn-bike-events"
DEFAULT_CREATED_AT = "2026-06-07T17:28:43.082Z"
DEFAULT_COUNT = 34
MAX_BATCH_WRITE_ITEMS = 25


def build_items(created_at: str, count: int) -> list[dict[str, str]]:
    return [
        {
            "id": f"{created_at}#{uuid.uuid4()}",
            "createdAt": created_at,
        }
        for _ in range(count)
    ]


def chunk_items(items: list[dict[str, str]], size: int) -> list[list[dict[str, str]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def to_dynamodb_batch(table_name: str, items: list[dict[str, str]]) -> dict:
    return {
        table_name: [
            {
                "PutRequest": {
                    "Item": {
                        "id": {"S": item["id"]},
                        "createdAt": {"S": item["createdAt"]},
                    }
                }
            }
            for item in items
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create bike event documents in DynamoDB with the AWS CLI."
    )
    parser.add_argument("--table", default=DEFAULT_TABLE_NAME)
    parser.add_argument("--created-at", default=DEFAULT_CREATED_AT)
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--profile")
    parser.add_argument("--region", default="eu-west-3")
    args = parser.parse_args()

    items = build_items(args.created_at, args.count)

    for batch in chunk_items(items, MAX_BATCH_WRITE_ITEMS):
        command = [
            "aws",
            "dynamodb",
            "batch-write-item",
            "--request-items",
            json.dumps(to_dynamodb_batch(args.table, batch)),
            "--region",
            args.region,
        ]
        if args.profile:
            command.extend(["--profile", args.profile])

        subprocess.run(command, check=True)

    print(f"Created {len(items)} items in {args.table}:")
    for item in items:
        print(item["id"])


if __name__ == "__main__":
    main()
