# Migración completa de LegalTech: App Service -> Azure VM con LLM offline

Esta guía es operativa para migrar el despliegue actual a VM en Azure, habilitar runtime LLM local y decomisionar App Service para reducir costos.

## 1) Objetivo técnico

- Mantener app Next.js funcionando.
- Desplegar por `push` a GitHub directamente en VM (CI/CD).
- Habilitar servicios locales para IA y almacenamiento histórico:
  - Ollama (LLM local)
  - Qdrant (índice/vector store)
  - MinIO (objetos/documentos históricos)
- Conservar Supabase al inicio (opcional) para transición sin fricción.

## 2) Arquitectura resultante (VM)

Servicios en `docker-compose.vm.yml`:

- `web`: aplicación Next.js
- `ollama`: inferencia LLM local
- `qdrant`: recuperación semántica
- `minio`: almacenamiento de documentos y biblioteca

## 3) Prerrequisitos Azure

1. VM Ubuntu 22.04+ (recomendado Standard_D4s_v5 o superior).
2. Disco suficiente (mínimo 200GB para histórico + modelos).
3. NSG con puertos:
   - 22 (SSH restringido a tu IP)
   - 80/443 (si vas con reverse proxy)
   - 3000 (temporal para prueba)
4. DNS apuntando a IP pública de VM.

### 3.1 Verificar que DNS apunta a la IP pública de la VM

Supongamos:

- Dominio/subdominio: `qa.tudominio.com`
- IP pública VM: `20.30.40.50`

1. En tu proveedor DNS crea registro `A`:
  - Host: `qa`
  - Tipo: `A`
  - Valor: `20.30.40.50`
  - TTL: `300` (5 min) para pruebas

2. Verifica desde tu equipo (Windows PowerShell):

```powershell
Resolve-DnsName qa.tudominio.com
nslookup qa.tudominio.com 8.8.8.8
```

3. Verifica desde Linux/macOS:

```bash
dig +short qa.tudominio.com
```

4. Si el resultado no es `20.30.40.50`, espera propagación (5-30 min con TTL bajo).

5. Prueba conectividad HTTP a la VM:

```bash
curl -I http://qa.tudominio.com:3000
```

Cuando configures reverse proxy con TLS, la prueba final será:

```bash
curl -I https://qa.tudominio.com
```

## 4) Bootstrap inicial en VM

Conéctate por SSH y ejecuta:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Cierra sesión y vuelve a entrar.

## 5) Secrets requeridos en GitHub

En tu repo -> Settings -> Secrets and variables -> Actions, agrega:

- `AZURE_VM_HOST` (IP o dominio de la VM)
- `AZURE_VM_USER` (usuario SSH)
- `AZURE_VM_SSH_KEY` (clave privada PEM)
- `VM_REPO_CLONE_URL` (URL clone HTTPS con token o SSH)

Ejemplo `VM_REPO_CLONE_URL` con PAT mínimo read:

`https://<token>@github.com/<owner>/<repo>.git`

## 6) CI/CD GitHub -> VM

Workflow listo en:

- `.github/workflows/deploy-vm-azure.yml`

Qué hace:

1. Conecta por SSH.
2. Clona o actualiza `/opt/legaltech`.
3. `git reset --hard origin/main`.
4. `docker compose up -d --build`.
5. Limpia imágenes huérfanas.

## 7) Configuración `.env` en VM

En `/opt/legaltech/.env` define al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEGAL_LLM_ENABLED=true`
- `LEGAL_LLM_ENDPOINT=http://ollama:11434/api/generate`
- `LEGAL_LLM_MODEL=qwen2.5:14b-instruct-q4_K_M`
- `LEGAL_LLM_TIMEOUT_MS=45000`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`

## 8) Inicializar modelo LLM en VM

Tras primer deploy:

```bash
cd /opt/legaltech
docker compose -f docker-compose.vm.yml exec ollama ollama pull qwen2.5:14b-instruct-q4_K_M
```

## 9) Pruebas de aceptación

1. `docker compose ps` todos los servicios arriba.
2. Abrir app en `http://<ip>:3000`.
3. `/asistente` responde sin error.
4. Cargar PDF y crear caso.
5. Verificar memoria de interacciones en Supabase.

## 10) Reverse proxy y TLS (recomendado)

En producción, agregar Nginx o Caddy para:

- Exponer 80/443
- TLS automático
- Proxy a `web:3000`

## 11) Plan de almacenamiento amplio

- MinIO: documentos de biblioteca, PDFs y artefactos.
- Qdrant: chunks/index semántico para recuperación.
- Supabase/Postgres: metadatos, sesiones, feedback y auditoría.
- Discos separados en VM:
  - `/data/ollama`
  - `/data/minio`
  - `/data/qdrant`

## 12) Decomisionar App Service (sin riesgo)

### Semana 1

- Mantener App Service activo en modo standby.
- Todo tráfico nuevo a VM.

### Semana 2

- Validar estabilidad: uptime, latencia, logs y errores.
- Confirmar flujos críticos jurídicos.

### Semana 3

- Detener workflow de App Service.
- Detener App Service y App Service Plan.
- Eliminar recursos para evitar cobro.

## 13) Checklist de cierre de migración

- [ ] Deploy automático a VM funcionando por push.
- [ ] LLM local respondiendo en asistente.
- [ ] Almacenamiento histórico operativo.
- [ ] Dominio apuntando a VM con TLS.
- [ ] App Service y plan eliminados.
