import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/providers/AuthProvider";
import { AgentsProvider } from "@/providers/AgentsProvider";
import { FlowsProvider } from "@/providers/FlowsProvider";
import { ToolRegistryProvider } from "@/providers/ToolRegistryProvider";
import { IntegrationsProvider } from "@/providers/IntegrationsProvider";
import { PoliciesProvider } from "@/providers/PoliciesProvider";
import { ConversationsProvider } from "@/providers/ConversationsProvider";
import { ProductsProvider } from "@/providers/ProductsProvider";
import { FrontsProvider } from "@/providers/FrontsProvider";
import { AuditLogProvider } from "@/providers/AuditLogProvider";
import { AgentDecisionLogProvider } from "@/providers/AgentDecisionLogProvider";
import { ToolExecutionHistoryProvider } from "@/providers/ToolExecutionHistoryProvider";
import { LLMConfigProvider } from "@/providers/LLMConfigProvider";
import { ChannelsProvider } from "@/providers/ChannelsProvider";
import { WhatsAppMessagesProvider } from "@/providers/WhatsAppMessagesProvider";
import { WhatsAppTemplatesProvider } from "@/providers/WhatsAppTemplatesProvider";
import { WhatsAppOptInProvider } from "@/providers/WhatsAppOptInProvider";
import { WhatsAppIdentityProvider } from "@/providers/WhatsAppIdentityProvider";
import { BusinessHoursProvider } from "@/providers/BusinessHoursProvider";
import { RoutingProvider } from "@/providers/RoutingProvider";
import { WhatsAppAuditProvider } from "@/providers/WhatsAppAuditProvider";
import { DemoSeedGate } from "@/components/DemoSeedGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Freia - AI Agent Automation Platform",
  description: "Freia: Intelligent AI agent automation platform for enterprise automation",
  keywords: ["AI", "automation", "agents", "enterprise", "workflow"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen`}
      >
        <DemoSeedGate>
        <AuthProvider>
          <LLMConfigProvider>
          <ChannelsProvider>
          <WhatsAppMessagesProvider>
          <WhatsAppTemplatesProvider>
          <WhatsAppOptInProvider>
          <WhatsAppIdentityProvider>
          <BusinessHoursProvider>
          <RoutingProvider>
          <WhatsAppAuditProvider>
          <AgentsProvider>
            <FlowsProvider>
              <ToolRegistryProvider>
              <IntegrationsProvider>
              <PoliciesProvider>
                <AuditLogProvider>
                  <AgentDecisionLogProvider>
                  <ToolExecutionHistoryProvider>
                    <ConversationsProvider>
                    <ProductsProvider>
                    <FrontsProvider>
                      {children}
                    </FrontsProvider>
                    </ProductsProvider>
                    </ConversationsProvider>
                  </ToolExecutionHistoryProvider>
                  </AgentDecisionLogProvider>
                </AuditLogProvider>
              </PoliciesProvider>
              </IntegrationsProvider>
              </ToolRegistryProvider>
            </FlowsProvider>
          </AgentsProvider>
          </WhatsAppAuditProvider>
          </RoutingProvider>
          </BusinessHoursProvider>
          </WhatsAppIdentityProvider>
          </WhatsAppOptInProvider>
          </WhatsAppTemplatesProvider>
          </WhatsAppMessagesProvider>
          </ChannelsProvider>
          </LLMConfigProvider>
        </AuthProvider>
        </DemoSeedGate>
      </body>
    </html>
  );
}
