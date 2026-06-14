#!/usr/bin/env bash
# ============================================================
# Build, tag, and push System A images to Docker Hub
# Usage: ./scripts/push-images.sh <dockerhub-username> [tag]
# Example: ./scripts/push-images.sh johndoe v1.0
# ============================================================

set -e   # exit immediately on any error

DOCKERHUB_USER=${1:?"Usage: $0 <dockerhub-username> [tag]"}
TAG=${2:-latest}

APP_IMAGE="$DOCKERHUB_USER/system-a-app:$TAG"
NGINX_IMAGE="$DOCKERHUB_USER/system-a-nginx:$TAG"

echo "============================================"
echo " Building & Pushing System A"
echo " App   → $APP_IMAGE"
echo " Nginx → $NGINX_IMAGE"
echo "============================================"
echo ""

# ── Step 1: Login ──────────────────────────────────────────
echo ">>> Logging in to Docker Hub..."
docker login

# ── Step 2: Build app image ────────────────────────────────
echo ""
echo ">>> Building app image..."
docker build \
  --platform linux/amd64 \
  -t "$APP_IMAGE" \
  .

# ── Step 3: Build nginx image ──────────────────────────────
echo ""
echo ">>> Building nginx image..."
docker build \
  --platform linux/amd64 \
  -t "$NGINX_IMAGE" \
  ./nginx

# ── Step 4: Push both ──────────────────────────────────────
echo ""
echo ">>> Pushing app image..."
docker push "$APP_IMAGE"

echo ""
echo ">>> Pushing nginx image..."
docker push "$NGINX_IMAGE"

# ── Step 5: Also tag as latest if a version tag was given ──
if [ "$TAG" != "latest" ]; then
  echo ""
  echo ">>> Also tagging as latest..."
  docker tag "$APP_IMAGE"   "$DOCKERHUB_USER/system-a-app:latest"
  docker tag "$NGINX_IMAGE" "$DOCKERHUB_USER/system-a-nginx:latest"
  docker push "$DOCKERHUB_USER/system-a-app:latest"
  docker push "$DOCKERHUB_USER/system-a-nginx:latest"
fi

echo ""
echo "============================================"
echo " Done! Images on Docker Hub:"
echo "   $APP_IMAGE"
echo "   $NGINX_IMAGE"
echo ""
echo " To run on any machine:"
echo "   DOCKERHUB_USER=$DOCKERHUB_USER docker compose up -d"
echo "============================================"#!/usr/bin/env bash
# ============================================================
# Build, tag, and push System A images to Docker Hub
# Usage: ./scripts/push-images.sh <dockerhub-username> [tag]
# Example: ./scripts/push-images.sh johndoe v1.0
# ============================================================

set -e   # exit immediately on any error

DOCKERHUB_USER=${1:?"Usage: $0 <dockerhub-username> [tag]"}
TAG=${2:-latest}

APP_IMAGE="$DOCKERHUB_USER/system-a-app:$TAG"
NGINX_IMAGE="$DOCKERHUB_USER/system-a-nginx:$TAG"

echo "============================================"
echo " Building & Pushing System A"
echo " App   → $APP_IMAGE"
echo " Nginx → $NGINX_IMAGE"
echo "============================================"
echo ""

# ── Step 1: Login ──────────────────────────────────────────
echo ">>> Logging in to Docker Hub..."
docker login

# ── Step 2: Build app image ────────────────────────────────
echo ""
echo ">>> Building app image..."
docker build \
  --platform linux/amd64 \
  -t "$APP_IMAGE" \
  .

# ── Step 3: Build nginx image ──────────────────────────────
echo ""
echo ">>> Building nginx image..."
docker build \
  --platform linux/amd64 \
  -t "$NGINX_IMAGE" \
  ./nginx

# ── Step 4: Push both ──────────────────────────────────────
echo ""
echo ">>> Pushing app image..."
docker push "$APP_IMAGE"

echo ""
echo ">>> Pushing nginx image..."
docker push "$NGINX_IMAGE"

# ── Step 5: Also tag as latest if a version tag was given ──
if [ "$TAG" != "latest" ]; then
  echo ""
  echo ">>> Also tagging as latest..."
  docker tag "$APP_IMAGE"   "$DOCKERHUB_USER/system-a-app:latest"
  docker tag "$NGINX_IMAGE" "$DOCKERHUB_USER/system-a-nginx:latest"
  docker push "$DOCKERHUB_USER/system-a-app:latest"
  docker push "$DOCKERHUB_USER/system-a-nginx:latest"
fi

echo ""
echo "============================================"
echo " Done! Images on Docker Hub:"
echo "   $APP_IMAGE"
echo "   $NGINX_IMAGE"
echo ""
echo " To run on any machine:"
echo "   DOCKERHUB_USER=$DOCKERHUB_USER docker compose up -d"
echo "============================================"