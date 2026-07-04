"use client";

import * as Accordion from "@radix-ui/react-accordion";
import FAQItem from "@/components/faq/FAQItem";

interface FAQAccordionProps {
  faqs: { id: string; question: string; answer: string }[];
}

export default function FAQAccordion({ faqs }: FAQAccordionProps) {
  return (
    <Accordion.Root type="multiple" className="space-y-3">
      {faqs.map((faq) => (
        <FAQItem key={faq.id} id={faq.id} question={faq.question} answer={faq.answer} />
      ))}
    </Accordion.Root>
  );
}
