/**
 * Opaque public asset paths — avoid descriptive filenames in the browser network tab.
 * When adding or replacing files in `public/`, update this map and rename on disk.
 */
export const PUBLIC_ASSETS = {
  logo: "/m8x4p2n7.png",
  onboarding: {
    default2x: { jpg: "/k3w9r1t5.jpg", webp: "/k3w9r1t5.webp" },
    source: "/s1c8e5t0.jpg",
    heroProfile: { jpg: "/h2n6v4k8.jpg", webp: "/h2n6v4k8.webp" },
    heroVoice: { jpg: "/j5q8w3r1.jpg", webp: "/j5q8w3r1.webp" },
    heroKnowledge: { jpg: "/x7k3m9p2.jpg", webp: "/x7k3m9p2.webp" },
    heroActionsOnward: { jpg: "/n6p2x9w4.jpg", webp: "/n6p2x9w4.webp" },
    heroPlan: { jpg: "/k8m3n7p2.jpg", webp: "/k8m3n7p2.webp" },
    authSignup: { jpg: "/q4r8t2w6.jpg", webp: "/q4r8t2w6.webp" },
  },
} as const;
