#!/bin/bash
echo "========================================"
echo "  Gerando Certificado SSL Auto-Assinado"
echo "  (Apenas para Desenvolvimento Local)"
echo "========================================"
echo ""

# Cria diretório para certificados se não existir
mkdir -p certs

echo "Gerando chave privada..."
openssl genrsa -out certs/dev.key 2048

echo ""
echo "Gerando certificado (válido por 365 dias)..."
openssl req -new -x509 -key certs/dev.key -out certs/dev.crt -days 365 \
  -subj "/C=BR/ST=SP/L=SaoPaulo/O=MireDesk Dev/CN=*.local"

echo ""
echo "========================================"
echo "  ✅ Certificados gerados com sucesso!"
echo "  📁 Localização: ./certs/"
echo "     - dev.key (chave privada)"
echo "     - dev.crt (certificado)"
echo "========================================"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Aceite o aviso de segurança no navegador"
echo "   - Este certificado é APENAS para desenvolvimento"
echo "   - Para produção, use Cloudflare Tunnel"
echo ""
