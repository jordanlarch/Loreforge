/**
 * Tutorial entity registry (TUT-1, #171) — "what your character knows".
 *
 * The Scene 2 cast that the GM references as @Entity chips. Clicking a chip
 * opens the entity drawer with these pre-written, in-character blurbs (the
 * tutorial is air-gapped, so this is hand-authored rather than RAG-derived).
 * Names must match the `mentions` the server posts (`@app/engine` tutorial
 * fixture) so a chip resolves to its entry. Speakable NPCs carry the dialogue
 * `topic` the drawer's "Speak to…" action triggers (the soft rail, D3b).
 */

export type EntityDisposition = "friendly" | "neutral" | "hostile" | "unknown";

export type TutorialEntity = {
  name: string;
  kind: "npc" | "place" | "item";
  /** One-line "species · role" style subtitle. */
  subtitle: string;
  /** What Mira knows about them right now. */
  known: string;
  disposition?: EntityDisposition;
  /** Scene 2 dialogue topic the "Speak to…" button triggers, if any. */
  speak?: "barnaby" | "lily";
};

export const TUTORIAL_ENTITIES: Record<string, TutorialEntity> = {
  "Barnaby Bramblefoot": {
    name: "Barnaby Bramblefoot",
    kind: "npc",
    subtitle: "Halfling · Tavernkeeper",
    known: "Keeps the Hearth and Hemlock. Warm, but watchful tonight.",
    disposition: "neutral",
    speak: "barnaby",
  },
  "Lily Lampmaker": {
    name: "Lily Lampmaker",
    kind: "npc",
    subtitle: "Human · Lampmaker's daughter",
    known:
      "Sits alone, grieving. The locals avoid her eye. She has a sealed letter and a look that's been crying.",
    disposition: "neutral",
    speak: "lily",
  },
  "Old Brennar": {
    name: "Old Brennar",
    kind: "npc",
    subtitle: "Human · Cleric of the Life Domain",
    known: "An old cleric in patched robes. Knew the missing lampkeeper.",
    disposition: "friendly",
  },
  "Marlowe the Lampkeeper": {
    name: "Marlowe the Lampkeeper",
    kind: "npc",
    subtitle: "Human · Lantern Spire keeper (missing)",
    known:
      "Tended the great lantern for years. Went up the spire three nights ago and never came down.",
    disposition: "unknown",
  },
  "The Lantern Spire": {
    name: "The Lantern Spire",
    kind: "place",
    subtitle: "Sealed tower at the village edge",
    known:
      "Home of the great lantern that holds the Hungering Forest at bay — now dark, and warded shut.",
  },
};

/** The registry entry for an entity name, or undefined if it isn't a known one. */
export function tutorialEntity(name: string): TutorialEntity | undefined {
  return TUTORIAL_ENTITIES[name];
}

const DISPOSITION_LABEL: Record<EntityDisposition, string> = {
  friendly: "Friendly",
  neutral: "Neutral",
  hostile: "Hostile",
  unknown: "Unknown",
};

export function dispositionLabel(d: EntityDisposition): string {
  return DISPOSITION_LABEL[d];
}
