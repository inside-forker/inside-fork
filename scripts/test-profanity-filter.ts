import {
  containsExplicitContent,
  findExplicitMatches,
  validateReviewContent,
  EXPLICIT_CONTENT_CODE,
} from "../lib/reviews/profanity-filter";

const testCases: Array<{ input: string; expected: boolean; description: string }> = [
  // English explicit
  { input: "This food was absolute shit!", expected: true, description: "Direct English profanity" },
  { input: "The waiter was a total asshole.", expected: true, description: "Direct English insult" },
  { input: "What the f*ck is this place?", expected: true, description: "Asterisk masked English profanity" },
  { input: "F.u.c.k this restaurant", expected: true, description: "Spaced/dotted English profanity" },
  { input: "You little b!tch", expected: true, description: "Exclamation mark leet profanity" },
  { input: "s h i t service", expected: true, description: "Spaced letters profanity" },

  // Roman Urdu explicit
  { input: "Ye log pagal or chutiya hain bilkul", expected: true, description: "Roman Urdu chutiya" },
  { input: "Kutta service and beghairat staff", expected: true, description: "Roman Urdu kutta + beghairat" },
  { input: "Ye restaurant waly bsdk hain", expected: true, description: "Roman Urdu bsdk" },
  { input: "ch*tiya log", expected: true, description: "Masked Roman Urdu" },
  { input: "madarchod staff", expected: true, description: "Direct abusive Roman Urdu" },

  // Threats & Spam
  { input: "I will kill you if I see you again", expected: true, description: "Direct threat" },
  { input: "Join our whatsapp group for daily signals", expected: true, description: "Spam whatsapp group" },
  { input: "Make money fast with crypto investment", expected: true, description: "Spam crypto investment" },

  // Clean negatives (must NOT match)
  { input: "The classic beef burger was delicious!", expected: false, description: "Clean: classic" },
  { input: "We had a pass for the weekend event.", expected: false, description: "Clean: pass" },
  { input: "The assistant manager helped us with our table.", expected: false, description: "Clean: assistant" },
  { input: "They served complementary biscuits with tea.", expected: false, description: "Clean: biscuits" },
  { input: "Amazing ambiance and very hospitable staff.", expected: false, description: "Clean regular review" },
  { input: "Great karahi, spicy and freshly made.", expected: false, description: "Clean Karachi food review" },
];

let failed = 0;

for (const { input, expected, description } of testCases) {
  const result = containsExplicitContent(input);
  const validation = validateReviewContent(input);

  if (result !== expected || validation.isValid === expected) {
    console.error(`❌ FAILED: ${description}`);
    console.error(`   Input: "${input}"`);
    console.error(`   Expected containsExplicitContent=${expected}, got=${result}`);
    console.error(`   Matches found:`, findExplicitMatches(input));
    failed++;
  } else {
    console.log(`✅ PASSED: ${description}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${testCases.length} tests passed successfully!`);
}
