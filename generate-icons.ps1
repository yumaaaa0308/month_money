Add-Type -AssemblyName System.Drawing

function New-Icon {
    param([int]$Size, [string]$OutPath, [double]$ContentScale = 0.62)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $bg = [System.Drawing.Color]::FromArgb(255, 11, 17, 32)      # #0b1120
    $accent = [System.Drawing.Color]::FromArgb(255, 20, 184, 166) # #14b8a6
    $g.Clear($bg)

    # coin with a yen sign (keep comments ASCII: PowerShell 5.1 misreads UTF-8 without BOM)
    $d = $Size * $ContentScale
    $x = ($Size - $d) / 2.0
    $brush = New-Object System.Drawing.SolidBrush($accent)
    $g.FillEllipse($brush, $x, $x, $d, $d)

    $fontSize = [float]($d * 0.62)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF($x, $x, $d, $d)
    $g.DrawString([string][char]0x00A5, $font, (New-Object System.Drawing.SolidBrush($bg)), $rect, $fmt)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconsDir = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

New-Icon -Size 192 -OutPath (Join-Path $iconsDir "icon-192.png") -ContentScale 0.62
New-Icon -Size 512 -OutPath (Join-Path $iconsDir "icon-512.png") -ContentScale 0.62
New-Icon -Size 512 -OutPath (Join-Path $iconsDir "icon-maskable-512.png") -ContentScale 0.46
New-Icon -Size 180 -OutPath (Join-Path $iconsDir "apple-touch-icon.png") -ContentScale 0.62

Write-Output "Icons generated in $iconsDir"
