import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileCaraPromptWithMeta,
  droppableSectionIdsForInput,
  MAX_PROMPT_CHARS,
} from "./compile-cara-prompt";
import { SERVICE_POLICY_INSTRUCTION } from "./service-policy-presets";
import {
  KNOWLEDGE_PRECEDENCE_INSTRUCTION,
  shouldDefaultAnswerEnabledOff,
} from "./knowledge-precedence";
import {
  assertRegisteredKnowledgeSectionIds,
  CARA_KNOWLEDGE_SURFACE_IDS,
  validateKnowledgeSurfaceRegistry,
} from "./knowledge-surfaces";

function longText(chars: number): string {
  return "x".repeat(chars);
}

function makeFaq(index: number, answerChars = 500) {
  return {
    question: `Question number ${index} about something specific?`,
    answer: longText(answerChars),
  };
}

describe("compileCaraPrompt budget assembly", () => {
  it("keeps routing block when many long FAQs exceed old 8k cap", () => {
    const faqs = Array.from({ length: 30 }, (_, i) => makeFaq(i + 1));
    const { prompt, compileMeta } = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      faqs,
      routes: [
        {
          trigger: "booking",
          action: "text them the booking link",
        },
      ],
      fallbackNote: "take their details for the team",
    });

    assert.match(prompt, /Routes are in priority order/);
    assert.match(prompt, /booking/);
    assert.ok(prompt.length <= MAX_PROMPT_CHARS);
    if (compileMeta.wasTrimmed) {
      assert.ok(compileMeta.droppedFaqCount > 0);
    }
  });

  it("trims FAQs before dropping routing", () => {
    const faqs = Array.from({ length: 30 }, (_, i) => makeFaq(i + 1, 1200));
    const { prompt, compileMeta } = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      faqs,
      routes: [
        {
          trigger: "price list",
          action: "send them the price list",
        },
      ],
    });

    assert.match(prompt, /How I decide:/);
    assert.equal(compileMeta.wasTrimmed, true);
    assert.ok(compileMeta.droppedFaqCount > 0);
  });

  it("reports nearBudget when prompt exceeds warn ratio", () => {
    const faqs = Array.from({ length: 20 }, (_, i) => ({
      question: `Q${i}`,
      answer: longText(800),
    }));
    const { compileMeta } = compileCaraPromptWithMeta({
      businessName: "Big Business",
      assistantDisplayName: "Cara",
      businessType: "trade",
      faqs,
    });

    if (compileMeta.charCount >= MAX_PROMPT_CHARS * 0.8) {
      assert.equal(compileMeta.nearBudget, true);
    }
  });

  it("respects never-quote rule over catalog prices", () => {
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      businessRules: ["Never quote prices over the phone"],
      quotePricesOnCalls: true,
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: "Hair",
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
    });

    assert.match(prompt, /do not quote prices on the phone/i);
    assert.doesNotMatch(prompt, /quote it with "from"/i);
  });

  it("includes service policy instruction when catalog has policyFlags", () => {
    const withPolicies = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Full colour",
          price: 85,
          durationMinutes: 120,
          category: null,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [{ type: "patch_test", hours: 48 }],
          source: "manual",
        },
      ],
    }).prompt;

    assert.match(withPolicies, /patch test is needed 48 hours/i);
    assert.ok(withPolicies.includes(SERVICE_POLICY_INSTRUCTION));

    const withoutPolicies = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: null,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
    }).prompt;

    assert.ok(!withoutPolicies.includes(SERVICE_POLICY_INSTRUCTION));
  });

  it("includes patch-test booking guidance when catalog has patch_test", () => {
    const prompt = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Root colour",
          price: 85,
          durationMinutes: 120,
          category: null,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [{ type: "patch_test", hours: 48 }],
          source: "manual",
        },
      ],
    }).prompt;

    assert.match(prompt, /Patch-test services \(Root colour\)/i);
    assert.match(prompt, /both texting the online booking link and a team callback/i);
  });

  it("includes callback-only guidance when catalog has callback_only", () => {
    const prompt = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "VIP colour",
          price: 120,
          durationMinutes: 120,
          category: null,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [{ type: "callback_only" }],
          source: "manual",
        },
      ],
    }).prompt;

    assert.match(prompt, /Callback-only services \(VIP colour\)/i);
    assert.match(prompt, /Do not offer the online booking link/i);
  });

  it("omits patch-test and callback-only sections when flags absent", () => {
    const prompt = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: null,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
    }).prompt;

    assert.doesNotMatch(prompt, /Patch-test services/i);
    assert.doesNotMatch(prompt, /Callback-only services/i);
  });

  it("escapes quotes in FAQ answers", () => {
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Shop",
      assistantDisplayName: "Cara",
      businessType: "retail",
      faqs: [
        {
          question: 'What is "special"?',
          answer: 'We say "hello" to everyone.',
        },
      ],
    });

    assert.match(prompt, /If someone asks "What is 'special'\?"/);
    assert.match(prompt, /I say: We say 'hello' to everyone\./);
  });

  it("keeps protected routing before trimmable knowledge in section order", () => {
    const faqs = Array.from({ length: 5 }, (_, i) => makeFaq(i + 1, 200));
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      faqs,
      businessRules: ["Always confirm the service they want"],
      routes: [{ trigger: "booking", action: "text them the booking link" }],
    });

    const routesIdx = prompt.indexOf("How I decide:");
    const rulesIdx = prompt.indexOf("Your rules");
    const faqIdx = prompt.indexOf("If someone asks");
    assert.ok(routesIdx >= 0);
    assert.ok(rulesIdx >= 0);
    assert.ok(faqIdx >= 0);
    assert.ok(routesIdx < rulesIdx);
    assert.ok(rulesIdx < faqIdx);
  });

  it("appends omission note when knowledge is trimmed", () => {
    const faqs = Array.from({ length: 30 }, (_, i) => makeFaq(i + 1, 1200));
    const { prompt, compileMeta } = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      faqs,
      routes: [{ trigger: "booking", action: "text them the booking link" }],
    });

    if (compileMeta.wasTrimmed) {
      assert.match(prompt, /some FAQs, files, or service knowledge was shortened/i);
    }
  });

  it("includes protected precedence when catalog and answer-enabled price list coexist", () => {
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Luna Hair",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: "Hair",
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
      businessFiles: [
        {
          id: "f1",
          fileName: "prices.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "price_list",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: "Cut €40",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    assert.match(prompt, new RegExp(KNOWLEDGE_PRECEDENCE_INSTRUCTION.slice(0, 40)));
    assert.match(prompt, /background reference only/i);
    assert.match(prompt, /Background reference — from uploaded files/i);
  });

  it("keeps protected precedence after budget trimming drops files and FAQs", () => {
    const faqs = Array.from({ length: 30 }, (_, i) => makeFaq(i + 1, 1200));
    const { prompt, compileMeta } = compileCaraPromptWithMeta({
      businessName: "Test Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      faqs,
      businessFiles: [
        {
          id: "f1",
          fileName: "menu.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "menu",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: longText(8000),
          createdAt: new Date().toISOString(),
        },
      ],
      anythingElse: longText(5000),
      routes: [{ trigger: "booking", action: "text them the booking link" }],
    });

    assert.equal(compileMeta.wasTrimmed, true);
    assert.match(prompt, new RegExp(KNOWLEDGE_PRECEDENCE_INSTRUCTION.slice(0, 40)));
  });

  it("omits send-only files from prompt knowledge", () => {
    const { prompt } = compileCaraPromptWithMeta({
      businessName: "Luna Hair",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: "Hair",
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
      businessFiles: [
        {
          id: "f1",
          fileName: "prices.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          answerEnabled: false,
          sendEnabled: true,
          documentKind: "price_list",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: "Cut €40",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    assert.doesNotMatch(prompt, /Background reference — from uploaded files/i);
    assert.doesNotMatch(prompt, /background reference only/i);
  });

  it("places supplement before files in section order", () => {
    const ids = droppableSectionIdsForInput({
      businessName: "Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: "Hair",
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
      serviceCatalogSupplement: {
        supplementalServices: ["Consultation"],
        generalNotes: "Patch test required",
      },
      businessFiles: [
        {
          id: "f1",
          fileName: "brochure.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "brochure",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: "Welcome",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const supplementIdx = ids.indexOf("supplement");
    const filesIdx = ids.indexOf("files");
    assert.ok(supplementIdx >= 0);
    assert.ok(filesIdx >= 0);
    assert.ok(supplementIdx < filesIdx);
  });
});

describe("knowledge-precedence helpers", () => {
  it("defaults answer off for price list when catalog exists", () => {
    assert.equal(
      shouldDefaultAnswerEnabledOff({
        documentKind: "price_list",
        hasServiceCatalog: true,
        hasFaqs: false,
        processingStatus: "ready",
        hasExtractedText: true,
      }),
      true,
    );
  });

  it("defaults answer off for faq document when FAQs exist", () => {
    assert.equal(
      shouldDefaultAnswerEnabledOff({
        documentKind: "faq_document",
        hasServiceCatalog: false,
        hasFaqs: true,
        processingStatus: "ready",
        hasExtractedText: true,
      }),
      true,
    );
  });

  it("allows answer on for brochure when catalog exists", () => {
    assert.equal(
      shouldDefaultAnswerEnabledOff({
        documentKind: "brochure",
        hasServiceCatalog: true,
        hasFaqs: false,
        processingStatus: "ready",
        hasExtractedText: true,
      }),
      false,
    );
  });
});

describe("knowledge-surfaces registry", () => {
  it("has unique precedence and drop ranks", () => {
    assert.doesNotThrow(() => validateKnowledgeSurfaceRegistry());
  });

  it("registers every emitted droppable section id", () => {
    const ids = droppableSectionIdsForInput({
      businessName: "Salon",
      assistantDisplayName: "Cara",
      businessType: "salon",
      businessRules: ["Be friendly"],
      caraRules: ["Warm tone"],
      greeting: "Hello",
      openingHours: "Mon 9-5",
      serviceArea: "Dublin",
      servicesOffered: "Haircuts",
      servicesNotOffered: "Nails",
      faqs: [{ question: "Parking?", answer: "Street parking out front." }],
      businessFiles: [
        {
          id: "f1",
          fileName: "menu.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "menu",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: "Services",
          createdAt: new Date().toISOString(),
        },
      ],
      serviceCatalog: [
        {
          id: "1",
          name: "Cut",
          price: 45,
          durationMinutes: 30,
          category: "Hair",
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
      serviceCatalogSupplement: {
        supplementalServices: ["Blow dry"],
        generalNotes: "",
      },
      anythingElse: "We love dogs.",
    });

    assert.doesNotThrow(() => assertRegisteredKnowledgeSectionIds(ids));
    for (const id of CARA_KNOWLEDGE_SURFACE_IDS) {
      assert.ok(typeof id === "string");
    }
  });
});
