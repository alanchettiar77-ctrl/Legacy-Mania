"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

interface FAQItemProps {
  id: string;
  question: string;
  answer: string;
}

export default function FAQItem({ id, question, answer }: FAQItemProps) {
  return (
    <Accordion.Item
      value={id}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-6 py-4 font-semibold text-foreground hover:text-primary transition-colors">
          {question}
          <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
          {answer}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
