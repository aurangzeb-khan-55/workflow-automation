#!/bin/bash
# Runs automatically once LocalStack is ready (mounted at
# /etc/localstack/init/ready.d — see docker-compose.yml). Creates the
# dev S3 bucket and configures CORS so the browser can PUT directly to
# signed upload URLs from the web app's origin — without this, every
# cross-origin upload's preflight OPTIONS request gets a 403 from
# LocalStack and the browser blocks the PUT before it's ever sent.
set -e

# Must match STORAGE_BUCKET in apps/api/.env.
BUCKET="atria-intake-dev"

awslocal s3api create-bucket --bucket "$BUCKET" --region us-east-1 2>/dev/null || true

awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

echo "LocalStack init: bucket '$BUCKET' ready with CORS configured"
