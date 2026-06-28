import { getWhatsAppUrl } from "@/lib/utils";
import { MessageCircle, ArrowRight } from "lucide-react";

export default function WhatsAppCTA() {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210";
  const message = "Hi Legacy Mania! I want to know more about your collectibles.";
  const url = getWhatsAppUrl(phone, message);

  return (
    <section className="section-padding bg-background">
      <div className="container-max">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f0f23] via-[#1a1a3e] to-[#0f0f23] border border-white/10 p-8 md:p-16 text-center">
          {/* Glow effects */}
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 mb-6">
              <MessageCircle className="w-8 h-8 text-[#25D366]" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Have Questions?
              <br />
              <span className="text-[#25D366]">Chat with us on WhatsApp</span>
            </h2>

            <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
              Our team is ready to help you find the perfect collectible.
              Available 10 AM – 8 PM IST.
            </p>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 active:scale-95 text-base shadow-lg shadow-green-500/30"
            >
              <MessageCircle className="w-5 h-5" />
              Chat Now on WhatsApp
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
