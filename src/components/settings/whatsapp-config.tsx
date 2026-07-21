"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, QrCode, Save } from "lucide-react";
import { toast } from "sonner";
import { SettingsPanelHead } from "./settings-panel-head";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type EvolutionConfig = {
  api_url: string;
  instance_name: string;
  status: "connected" | "connecting" | "disconnected" | "error";
  connected_phone?: string | null;
};

export function WhatsAppConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("BeHub");
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const isConnected = config?.status === "connected";
  const connectedPhone = config?.connected_phone
    ? `+${config.connected_phone}`
    : "Número confirmado pela Evolution";

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/evolution/config", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.config) {
        setConfig(payload.config);
        setApiUrl(payload.config.api_url || "");
        setInstanceName(payload.config.instance_name || "BeHub");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/evolution/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_url: apiUrl, api_key: apiKey, instance_name: instanceName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao salvar");
      setConfig(payload.config);
      setApiKey("");
      toast.success("Evolution API conectada ao CRM");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function loadQr() {
    try {
      const response = await fetch("/api/evolution/qr", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao gerar QR Code");
      const image = payload.base64 || payload.code || null;
      setQr(image ? (String(image).startsWith("data:") ? image : `data:image/png;base64,${image}`) : null);
      setPairingCode(payload.pairingCode || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar QR Code");
    }
  }

  return (
    <section>
      <SettingsPanelHead title="WhatsApp pela Evolution API" description="Leia e responda mensagens diretamente na Caixa de entrada do CRM." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Conexão da VPS</CardTitle>
            <CardDescription>A chave é criptografada antes de ser gravada no Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config && (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>{config.status === "connected" ? "WhatsApp conectado" : "Instância configurada"}</AlertTitle>
                <AlertDescription>
                  {isConnected ? `Número ativo: ${connectedPhone}` : `Status atual: ${config.status}`}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Endereço da Evolution API</Label>
              <Input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://evolution.seudominio.com" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Nome da instância</Label>
              <Input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder="BeHub" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Chave da API</Label>
              <div className="flex gap-2">
                <Input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config ? "Digite novamente somente para alterar" : "Cole a chave da Evolution"} />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowKey((value) => !value)}>{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
              </div>
            </div>
            <Button onClick={save} disabled={saving || !apiUrl || (!config && !apiKey) || !instanceName}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar e testar conexão
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{isConnected ? "WhatsApp ativo" : "Vincular WhatsApp"}</CardTitle>
            <CardDescription>
              {isConnected
                ? "Esta instância já está ocupada por um número. Para outro número, use uma nova instância."
                : "O QR Code pode ser escaneado aqui no CRM; não será necessário abrir o painel da VPS."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isConnected ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border bg-emerald-500/5 p-6">
                <CheckCircle2 className="size-20 text-emerald-500" />
                <p className="text-lg font-semibold">{connectedPhone}</p>
                <p className="text-sm text-muted-foreground">Instância {config.instance_name} conectada</p>
              </div>
            ) : (
              <>
                {qr ? <img src={qr} alt="QR Code do WhatsApp" className="mx-auto size-64 rounded-lg bg-white p-3" /> : <div className="mx-auto flex size-64 items-center justify-center rounded-lg border border-dashed"><QrCode className="size-20 text-muted-foreground" /></div>}
                {pairingCode && <p className="font-mono text-lg font-semibold">Código: {pairingCode}</p>}
                <Button variant="outline" onClick={loadQr} disabled={!config}><QrCode className="size-4" />Gerar ou atualizar QR Code</Button>
                <p className="text-xs text-muted-foreground">WhatsApp → Aparelhos conectados → Conectar um aparelho.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
