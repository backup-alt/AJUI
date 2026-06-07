$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

& "$Root\node_modules\.bin\ng.cmd" serve --host 127.0.0.1 --port 5188
