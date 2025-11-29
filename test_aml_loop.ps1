
$clientId = "mumbai-hacks-client-001"
$secretKey = "hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c"
$gatewayUrl = "http://localhost:3000"
$path = "/v1/transaction/assess"

function Send-Transaction {
    param (
        [string]$userId,
        [string]$receiverId,
        [int]$amount
    )

    $body = @{
        amount = $amount
        currency = "INR"
        merchantId = "aml_simulation"
        userId = $userId
        receiverId = $receiverId
        paymentMethod = "UPI"
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    $bodyJson = $body | ConvertTo-Json -Compress

    $timestamp = [string][int64]((Get-Date).ToUniversalTime() - (Get-Date "1/1/1970")).TotalMilliseconds
    $stringToSign = "$timestamp" + "POST" + "$path" + "$bodyJson"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secretKey))
    $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($stringToSign))
    $signature = [BitConverter]::ToString($signatureBytes).Replace("-", "").ToLower()

    $headers = @{
        "x-client-id" = $clientId
        "x-timestamp" = $timestamp
        "x-signature" = $signature
    }

    $uri = "$gatewayUrl$path"
    Write-Host "Sending: $userId -> $receiverId (₹$amount)"
    
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $bodyJson -ContentType "application/json"
        Write-Host "Success: $($response.status) (TxnId: $($response.txnId))" -ForegroundColor Green
    } catch {
        Write-Host "Failed: $_" -ForegroundColor Red
    }
}

Write-Host "--- Starting AML Laundering Loop Simulation ---" -ForegroundColor Cyan
# Step 1: User A -> User B
Send-Transaction -userId "User_A" -receiverId "User_B" -amount 5000
Start-Sleep -Seconds 1

# Step 2: User B -> User C
Send-Transaction -userId "User_B" -receiverId "User_C" -amount 4900
Start-Sleep -Seconds 1

# Step 3: User C -> User A (Closing the loop)
Send-Transaction -userId "User_C" -receiverId "User_A" -amount 4800

Write-Host "--- Simulation Complete. Check Discord for SAR Alert ---" -ForegroundColor Cyan
