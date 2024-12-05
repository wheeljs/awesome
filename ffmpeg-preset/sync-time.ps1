param (
    [string]$inputPath,
    [string]$outputPath
)

if (-not (Test-Path -Path $inputPath)) {
    exit 1
}

$inFile = Get-Item -Path $inputPath
$creationTime = $inFile.CreationTime
$lastWriteTime = $inFile.LastWriteTime

if (-not (Test-Path -Path $outputPath)) {
    exit 1
}

$outFile = Get-Item -Path $outputPath
$outFile.CreationTime = $creationTime
$outFile.LastWriteTime = $lastWriteTime
