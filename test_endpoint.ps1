
$clientId = "mumbai-hacks-client-001"
$secretKey = "hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c"
$gatewayUrl = "http://34.14.156.36"
$path = "/v1/transaction/assess"

$body = @{
    amount = 5000
    currency = "INR"
    merchantId = "mer_123"
    userId = "user_456"
    paymentMethod = "UPI"
    vpa = "fraud@upi"
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
Write-Host "POSTing to $uri"
Write-Host "Headers: $($headers | ConvertTo-Json)"
Write-Host "Body: $bodyJson"

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $bodyJson -ContentType "application/json"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $reader.ReadToEnd()
}
