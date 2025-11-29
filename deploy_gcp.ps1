# GCP Deployment Script for Fintech Platform
$PROJECT_ID = "mumbaihacks-1"
$REGION = "asia-south1"
$CLUSTER_NAME = "fintech-cluster-mumbai"
$KEY_FILE = "mumbaihacks-1-b626f1941eb6.json"

Write-Host "Starting Deployment to GCP ($PROJECT_ID)..." -ForegroundColor Green

# 1. Authenticate with Service Account
Write-Host "Authenticating with Service Account..."
gcloud auth activate-service-account --key-file=$KEY_FILE --project=$PROJECT_ID

# 2. Enable Required APIs (Force)
Write-Host "Enabling Required APIs... (Skipping as User Enabled Manually)"
# Service Usage is often required to enable other APIs
# Write-Host "Enabling Service Usage API..."
# gcloud services enable serviceusage.googleapis.com

# Write-Host "Enabling Cloud Resource Manager API..."
# gcloud services enable cloudresourcemanager.googleapis.com

# Write-Host "Enabling Compute Engine API..."
# gcloud services enable compute.googleapis.com

# Write-Host "Enabling Kubernetes Engine API..."
# gcloud services enable container.googleapis.com

# Write-Host "Enabling Artifact Registry API..."
# gcloud services enable artifactregistry.googleapis.com

# 3. Create GKE Cluster (if not exists)
Write-Host "Checking for GKE Cluster..."
$CLUSTER_EXISTS = gcloud container clusters list --filter="name:$CLUSTER_NAME" --format="value(name)"
if (-not $CLUSTER_EXISTS) {
    Write-Host "Creating GKE Cluster '$CLUSTER_NAME' (This may take 10-15 minutes)..."
    gcloud container clusters create $CLUSTER_NAME `
        --region $REGION `
        --num-nodes 1 `
        --machine-type e2-medium `
        --disk-size 30GB `
        --service-account="fintech-protective-layer@mumbaihacks-1.iam.gserviceaccount.com"
} else {
    Write-Host "Cluster '$CLUSTER_NAME' already exists."
}

# 4. Configure Docker
Write-Host "Configuring Docker for GCR..."
gcloud auth configure-docker

# 5. Build and Push Images
$SERVICES = @("gateway", "risk-engine", "post-auth-worker", "ai-graph-service", "webhook-service")

foreach ($SERVICE in $SERVICES) {
    Write-Host "Building and Pushing $SERVICE..."
    $IMAGE_TAG = "gcr.io/$PROJECT_ID/$SERVICE`:latest"
    
    # Use --no-cache to ensure fresh build with inlined Logger
    docker build -t $IMAGE_TAG ./services/$SERVICE
    docker push $IMAGE_TAG
}

# 6. Connect to GKE Cluster
Write-Host "Connecting to GKE Cluster..."
gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID

# 7. Create Secrets (Safe Method)
Write-Host "Creating Secrets..."
# Delete existing secret if it exists to avoid error
kubectl delete secret fintech-secrets --ignore-not-found

# Create secret from the key file and other literals
kubectl create secret generic fintech-secrets `
    --from-file=GOOGLE_APPLICATION_CREDENTIALS=$KEY_FILE `
    --from-literal=HMAC_SECRET="hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c" `
    --from-literal=NEO4J_PASSWORD="password" `
    --from-literal=DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/1443623614195957762/gKUbDF0BPtGQ_6E_tCDSporXCdQHppUyk17y8mwZTPXmVhe0tBSBQx5znmgvM8ZiDdhn"

# 8. Apply Manifests
Write-Host "Applying Kubernetes Manifests..."
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/neo4j.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/risk-engine.yaml
kubectl apply -f k8s/post-auth-worker.yaml
kubectl apply -f k8s/ai-graph-service.yaml
kubectl apply -f k8s/webhook-service.yaml

Write-Host "Deployment Complete!" -ForegroundColor Green
kubectl get services
