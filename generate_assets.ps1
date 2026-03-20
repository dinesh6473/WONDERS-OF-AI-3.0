Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\karte\OneDrive\Pictures\Wonder\WONDERS-OF-AI-3.0\public\logo.jpg'
$iconOut = 'C:\Users\karte\OneDrive\Pictures\Wonder\WONDERS-OF-AI-3.0\assets\icon.png'
$splashOut = 'C:\Users\karte\OneDrive\Pictures\Wonder\WONDERS-OF-AI-3.0\assets\splash.png'

$img = [System.Drawing.Image]::FromFile($srcPath)

# Generate 1024x1024 icon (white background)
$iconBmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($iconBmp)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcSize = [Math]::Min($img.Width, $img.Height)
$srcX = ($img.Width - $srcSize) / 2
$srcY = ($img.Height - $srcSize) / 2
$g.DrawImage($img, [System.Drawing.Rectangle]::new(0, 0, 1024, 1024), [System.Drawing.Rectangle]::new($srcX, $srcY, $srcSize, $srcSize), [System.Drawing.GraphicsUnit]::Pixel)
$iconBmp.Save($iconOut, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Icon saved: $iconOut"

# Generate 2732x2732 splash (white background, logo centered at 800px)
$splashBmp = New-Object System.Drawing.Bitmap(2732, 2732)
$gs = [System.Drawing.Graphics]::FromImage($splashBmp)
$gs.Clear([System.Drawing.Color]::White)
$gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$logoSize = 900
$lx = (2732 - $logoSize) / 2
$ly = (2732 - $logoSize) / 2
$gs.DrawImage($img, [System.Drawing.Rectangle]::new($lx, $ly, $logoSize, $logoSize), [System.Drawing.Rectangle]::new($srcX, $srcY, $srcSize, $srcSize), [System.Drawing.GraphicsUnit]::Pixel)
$splashBmp.Save($splashOut, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Splash saved: $splashOut"

$img.Dispose()
$g.Dispose()
$iconBmp.Dispose()
$gs.Dispose()
$splashBmp.Dispose()
Write-Host "All done!"
