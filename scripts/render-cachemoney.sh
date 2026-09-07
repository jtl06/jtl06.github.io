#!/bin/sh
set -eu

cd "$(dirname "$0")/../quarto/cachemoney"
quarto render cachemoney.qmd --to html --no-execute --output index.html
