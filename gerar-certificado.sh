#!/bin/bash
echo "========================================"
echo "  Gerando Certificado SSL Auto-Assinado"
echo "========================================"
echo ""

echo "Gerando chave privada..."
openssl genrsa -out cert.key 2048

echo ""
echo "Gerando certificado (válido por 365 dias)..."
openssl req -new -x509 -key cert.key -out cert.crt -days 365 \
  -subj "/C=BR/ST=SP/L=SaoPaulo/O=MireDesk/CN=localhost"

echo ""
echo "========================================"
echo "  Certificados gerados com sucesso!"
echo "  - cert.key (chave privada)"
echo "  - cert.crt (certificado)"
echo "========================================"
echo ""
echo "IMPORTANTE: Você precisará aceitar o certificado"
echo "no navegador (aviso de segurança)."
echo ""
