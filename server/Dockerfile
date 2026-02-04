FROM node:22-slim

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante do código do servidor
COPY . .

# Expõe a porta do servidor de atualização/sinalização
EXPOSE 3001

# Comando para iniciar o servidor
CMD ["node", "index.js"]
