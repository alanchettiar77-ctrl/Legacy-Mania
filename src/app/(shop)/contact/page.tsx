"use client";

import { useState } from "react";
import { MessageCircle, Mail, Clock, MapPin } from "lucide-react";

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919999999999";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText("support@legacymania.in");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="section-padding">
      <div className="container-max px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Get In Touch
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Have a question about an order, a card you&apos;re looking for, or
              anything else? We&apos;re happy to help.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi Legacy Mania, I have a question!`}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card border border-border rounded-2xl p-6 hover:border-green-500/50 transition-colors block"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-green-500" />
              </div>
              <h2 className="font-bold text-foreground mb-1">
                WhatsApp (Fastest)
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Chat with us directly for order help, product inquiries, or
                anything else. We typically respond within 30 minutes during
                business hours.
              </p>
              <span className="text-sm font-semibold text-green-500 group-hover:underline">
                +{WHATSAPP_NUMBER} →
              </span>
            </a>

            {/* Email */}
            <button
              onClick={copyEmail}
              className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors text-left w-full"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-bold text-foreground mb-1">Email</h2>
              <p className="text-sm text-muted-foreground mb-3">
                For detailed queries, returns, or formal communication. We
                respond within 24 hours on business days.
              </p>
              <span className="text-sm font-semibold text-primary group-hover:underline">
                {copied ? "Copied!" : "support@legacymania.in →"}
              </span>
            </button>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-accent rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Business Hours
                </h3>
                <p className="text-sm text-muted-foreground">
                  Monday – Saturday: 10:00 AM – 8:00 PM IST
                  <br />
                  Sunday: Closed
                </p>
              </div>
            </div>

            <div className="bg-accent rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Based In
                </h3>
                <p className="text-sm text-muted-foreground">
                  Mumbai, Maharashtra, India
                  <br />
                  Shipping Pan-India
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 bg-card border border-border rounded-2xl p-6 text-center">
            <p className="font-semibold text-foreground mb-2">
              Looking for a specific card?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Message us the card name, set, and condition on WhatsApp. We
              source from verified collectors across India.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi! I'm looking for a specific card.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Message on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
