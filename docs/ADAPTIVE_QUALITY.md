# Sistema de Qualidade Adaptativa - MiréDesk

## 📊 Visão Geral

O sistema de qualidade adaptativa ajusta automaticamente a qualidade do stream de vídeo com base nas condições da rede, otimizando a experiência do usuário entre qualidade visual e performance.

## 🎯 Funcionalidades

### Modo Automático (Adaptativo)
- **Monitoramento contínuo** de métricas de rede (RTT, perda de pacotes, jitter, bitrate)
- **Ajuste dinâmico** de qualidade a cada 2 segundos
- **Suavização** usando média móvel das últimas 5 medições
- **Hysteresis** para evitar mudanças bruscas (thrashing)

### Modo Manual
- **5 níveis de qualidade** predefinidos
- Controle granular sobre JPEG quality e block size
- Override instantâneo do modo adaptativo

---

## 📁 Arquivos Implementados

### Frontend (React/TypeScript)

#### 1. `frontend/hooks/useNetworkQuality.ts` (237 linhas)
**Hook principal para monitoramento e controle de qualidade**

**Exports:**
```typescript
interface NetworkMetrics {
    rtt: number;         // Latência (ms)
    packetLoss: number;  // Taxa de perda (0-1)
    bitrate: number;     // Bitrate atual (bps)
    jitter: number;      // Variação de latência (ms)
    timestamp: number;
}

interface QualityLevel {
    level: number;           // 1-5
    jpegQuality: number;     // 10-100
    blockSize: number;       // 32-128 px
    targetBitrate: number;   // Mbps
    description: string;
}
```

**Uso:**
```typescript
import { useNetworkQuality } from '../hooks/useNetworkQuality';

const {
    metrics,              // Métricas atuais de rede
    currentQuality,       // Qualidade atual aplicada
    qualityPresets,       // 5 presets disponíveis
    isAdaptive,           // Modo adaptativo ativo?
    isManual,             // Override manual ativo?
    setManualQuality,     // Função: definir qualidade manualmente
    enableAdaptive,       // Função: voltar ao modo adaptativo
    measureNetworkMetrics // Função: medir agora (força medição)
} = useNetworkQuality(peerConnection);
```

**Presets de Qualidade:**
```typescript
Level 1 - Baixa (0.5 Mbps)
  JPEG: 30%, BlockSize: 128px
  Uso: Redes 3G, alta latência (>200ms)

Level 2 - Média-Baixa (1.0 Mbps)
  JPEG: 50%, BlockSize: 96px
  Uso: Redes 4G instáveis

Level 3 - Média (2.0 Mbps) [PADRÃO]
  JPEG: 65%, BlockSize: 64px
  Uso: Redes WiFi domésticas

Level 4 - Alta (4.0 Mbps)
  JPEG: 80%, BlockSize: 64px
  Uso: Redes corporativas

Level 5 - Máxima (8.0 Mbps)
  JPEG: 95%, BlockSize: 48px
  Uso: LAN/Gigabit
```

#### 2. `frontend/hooks/useNativeQualityControl.ts` (62 linhas)
**Hook para comunicação com o agente nativo Delphi**

**Uso:**
```typescript
import { useNativeQualityControl } from '../hooks/useNativeQualityControl';

const { getCurrentQuality, setQualityLevel } = useNativeQualityControl('http://localhost:9876');

// Obter qualidade atual do agente
const settings = await getCurrentQuality();
console.log(settings);  // { level: 3, jpegQuality: 65, blockSize: 64, targetBitrate: 2.0 }

// Definir qualidade no agente
const success = await setQualityLevel(4);  // Muda para "Alta"
```

#### 3. `frontend/components/QualityControl.tsx` (211 linhas)
**Componente UI para controle de qualidade**

**Features:**
- Indicador de sinal com cores (verde/amarelo/laranja/vermelho)
- Painel expansível com métricas em tempo real
- 5 botões de preset de qualidade
- Toggle modo adaptativo/manual
- Design glassmorphism moderno

**Props:**
```typescript
interface QualityControlProps {
    metrics: NetworkMetrics;
    currentQuality: QualityLevel;
    qualityPresets: QualityLevel[];
    isAdaptive: boolean;
    isManual: boolean;
    onSetManualQuality: (level: number) => void;
    onEnableAdaptive: () => void;
}
```

#### 4. `frontend/components/SessionView.tsx` (atualizado)
**Integração do QualityControl no viewer**

Adiciona props opcionais:
```typescript
interface SessionViewProps {
    // ... props existentes
    
    // Quality control (opcionais)
    networkMetrics?: NetworkMetrics;
    currentQuality?: QualityLevel;
    qualityPresets?: QualityLevel[];
    isAdaptive?: boolean;
    isManualQuality?: boolean;
    onSetManualQuality?: (level: number) => void;
    onEnableAdaptive?: () => void;
}
```

---

### Backend (Delphi Service)

#### 5. `native_service/ServerWorker.pas` (atualizado)

**Novos campos privados:**
```pascal
FJpegQuality: Integer;      // 10-100
FTargetBitrate: Double;     // Mbps
FQualityLevel: Integer;     // 1-5
FBlockSize: Integer;        // 32-128 px (já existente, agora dinâmico)
```

**Novo método:**
```pascal
procedure TServiceWorker.UpdateQualitySettings(AQualityLevel: Integer);
```

Aplica preset de qualidade:
1. Valida nível (1-5)
2. Atualiza FJpegQuality, FBlockSize, FTargetBitrate
3. Recria encoder com novos parâmetros
4. Reseta FPreviousFrame (força frame completo)
5. Loga alteração

**Novo endpoint HTTP:**
```
GET  /quality → Retorna settings atuais (JSON)
POST /quality → Define novo nível (JSON body: {"level": 1-5})
```

**Exemplo de resposta GET:**
```json
{
  "level": 3,
  "jpegQuality": 65,
  "blockSize": 64,
  "targetBitrate": 2.0
}
```

**Exemplo de requisição POST:**
```bash
curl -X POST http://localhost:9876/quality \
  -H "Content-Type: application/json" \
  -d '{"level": 4}'
```

**Resposta POST (sucesso):**
```json
{
  "success": true,
  "level": 4,
  "jpegQuality": 80,
  "blockSize": 64
}
```

---

## 🚀 Como Usar

### 1. Integração Básica (Automático)

No componente pai (ex: `Dashboard.tsx` ou onde `useRemoteSession` é usado):

```typescript
import { useNetworkQuality } from './hooks/useNetworkQuality';
import { useNativeQualityControl } from './hooks/useNativeQualityControl';

function MyComponent() {
    const { peerConnection } = useRemoteSession(...);
    
    // Monitoramento automático de qualidade
    const {
        metrics,
        currentQuality,
        qualityPresets,
        isAdaptive,
        isManual,
        setManualQuality,
        enableAdaptive
    } = useNetworkQuality(peerConnection);
    
    // Comunicação com agente nativo
    const { setQualityLevel } = useNativeQualityControl('http://localhost:9876');
    
    // Aplicar qualidade no agente quando mudar
    useEffect(() => {
        if (currentQuality) {
            setQualityLevel(currentQuality.level);
        }
    }, [currentQuality.level, setQualityLevel]);
    
    return (
        <SessionView
            {...props}
            networkMetrics={metrics}
            currentQuality={currentQuality}
            qualityPresets={qualityPresets}
            isAdaptive={isAdaptive}
            isManualQuality={isManual}
            onSetManualQuality={setManualQuality}
            onEnableAdaptive={enableAdaptive}
        />
    );
}
```

### 2. Modo Manual

Para forçar uma qualidade específica:

```typescript
// Definir qualidade baixa (poupança de dados)
setManualQuality(1);

// Definir qualidade máxima
setManualQuality(5);

// Voltar ao modo adaptativo
enableAdaptive();
```

### 3. Monitoramento de Métricas

```typescript
useEffect(() => {
    console.log('Latência:', metrics.rtt, 'ms');
    console.log('Perda de pacotes:', (metrics.packetLoss * 100).toFixed(1), '%');
    console.log('Bitrate:', (metrics.bitrate / 1000000).toFixed(1), 'Mbps');
    
    // Alerta se rede ruim
    if (metrics.rtt > 200 || metrics.packetLoss > 0.05) {
        alert('Rede instável detectada! Reduzindo qualidade automaticamente.');
    }
}, [metrics]);
```

---

## ⚙️ Algoritmo de Decisão

### Cálculo de Score (0-100)

```
score = 100

# Penalidades
if RTT > 50ms:
    score -= min(40, (RTT - 50) / 5)

if PacketLoss > 1%:
    score -= min(40, PacketLoss * 4000)

if Jitter > 30ms:
    score -= min(20, (Jitter - 30) / 2)
```

### Mapeamento Score → Level

| Score | Nível | Descrição |
|-------|-------|-----------|
| 90-100 | 5 | Excelente (8 Mbps) |
| 75-89 | 4 | Boa (4 Mbps) |
| 55-74 | 3 | Média (2 Mbps) |
| 35-54 | 2 | Baixa (1 Mbps) |
| 0-34 | 1 | Muito baixa (0.5 Mbps) |

### Suavização (Média Móvel)

```
qualityHistory = [level_t-4, level_t-3, level_t-2, level_t-1, level_t]
finalLevel = round(average(qualityHistory))
```

Isso evita mudanças bruscas quando a rede oscila temporariamente.

---

## 🧪 Testes

### Simular Rede Ruim (Chrome DevTools)

1. Abrir DevTools → **Network** tab
2. Clicar em "Throttling" dropdown
3. Selecionar preset:
   - **Fast 3G**: ~1.6 Mbps down, 100ms RTT
   - **Slow 3G**: ~400 Kbps down, 400ms RTT
   - **Custom**: Definir valores específicos

4. Observar mudanças automáticas no painel de qualidade

### Testes Manuais

```bash
# Terminal 1: Iniciar agente
cd native_service
MireDeskAgent.exe

# Terminal 2: Verificar qualidade inicial
curl http://localhost:9876/quality

# Terminal 3: Mudar qualidade manualmente
curl -X POST http://localhost:9876/quality \
  -H "Content-Type: application/json" \
  -d '{"level": 1}'

# Verificar logs
type %TEMP%\MireDeskAgent.log | findstr Quality
```

**Log esperado:**
```
[16/02/2026 18:30:00] [Quality] Initial: Level 3, JPEG 65%, BlockSize 64px
[16/02/2026 18:30:15] [Quality] Updated: Level 1 → JPEG 30%, BlockSize 128px, Target 0.5 Mbps
```

---

## 📊 Métricas de Performance

### Redução de Banda por Nível

| Nível | JPEG | BlockSize | Banda (1080p idle) | Banda (1080p movimento) |
|-------|------|-----------|-------------------|------------------------|
| 1 | 30% | 128px | 0.3-0.5 Mbps | 0.8-1.2 Mbps |
| 2 | 50% | 96px | 0.6-0.9 Mbps | 1.2-1.8 Mbps |
| 3 | 65% | 64px | 1.0-1.5 Mbps | 2.0-3.0 Mbps |
| 4 | 80% | 64px | 2.0-3.0 Mbps | 4.0-5.5 Mbps |
| 5 | 95% | 48px | 4.0-6.0 Mbps | 8.0-12 Mbps |

### Latência Adicional por Nível

| Nível | Encoding (CPU) | Network | Total |
|-------|---------------|---------|-------|
| 1 | ~2ms | 50-200ms | 52-202ms |
| 3 | ~5ms | 30-100ms | 35-105ms |
| 5 | ~12ms | 16-50ms | 28-62ms |

---

## 🐛 Troubleshooting

### Problema: Qualidade não muda automaticamente

**Causa:** PeerConnection não está disponível  
**Solução:** Verificar se `useNetworkQuality(peerConnection)` recebe conexão válida após connect

```typescript
// ✗ Errado
const quality = useNetworkQuality(null);

// ✓ Correto
const { peerConnection } = usePeerConnection(...);
const quality = useNetworkQuality(peerConnection);
```

### Problema: Agente não responde a /quality

**Causa:** Serviço não está rodando ou porta bloqueada  
**Solução:**
```bash
# Verificar se porta 9876 está escutando
netstat -ano | findstr :9876

# Se não aparecer, reiniciar serviço
sc stop MireDeskService
sc start MireDeskService
```

### Problema: Mudanças muito frequentes (thrashing)

**Causa:** Rede muito instável  
**Solução:** Aumentar janela de suavização

Em `useNetworkQuality.ts`, linha 104:
```typescript
// Antes
if (qualityHistoryRef.current.length > 5) {

// Depois (suavização mais forte)
if (qualityHistoryRef.current.length > 10) {
```

---

## 🔮 Melhorias Futuras

1. **Machine Learning**: Predição de qualidade ideal usando histórico
2. **TURN integration**: Detectar quando relay está ativo e ajustar
3. **User feedback**: Botão "Qualidade ruim" para override inteligente
4. **Analytics**: Dashboard com gráficos de RTT/bitrate ao longo do tempo
5. **Perfis customizados**: Salvar configurações por contato
6. **Notificações**: Alertar usuário quando rede está crítica

---

## 📚 Referências

- **WebRTC Stats API**: https://www.w3.org/TR/webrtc-stats/
- **JPEG Quality**: https://en.wikipedia.org/wiki/JPEG#Compression_ratio_and_artifacts
- **Adaptive Bitrate Streaming**: https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Adaptive_streaming
- **Network Throttling**: https://developer.chrome.com/docs/devtools/network/reference/#throttling

---

**Versão:** 1.0.0  
**Data:** 16/02/2026  
**Autor:** Sistema de Qualidade Adaptativa MiréDesk
