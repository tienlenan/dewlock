/**
 * Onboarding-tour step definitions (theme-agnostic copy + anchors).
 *
 * Each `element` is a `data-tour="…"` selector added to the live UI (see the
 * chat composer, sidebar nav, and header buttons). The engine filters out any
 * step whose anchor isn't in the DOM at start time, so conditional/responsive
 * elements never produce an empty spotlight.
 *
 * Desktop and mobile differ in one step: desktop points at the always-visible
 * sidebar nav; mobile (sidebar is a drawer) points at the hamburger that opens it.
 */

import type { DriveStep } from "driver.js";

const introStep: DriveStep = {
  popover: {
    title: "Welcome to Dewlock 👋",
    description:
      "Your intent-firewall copilot for Sui DeFi. Take this 30-second tour to see how it works — or skip anytime.",
  },
};

const composerStep: DriveStep = {
  element: '[data-tour="composer"]',
  popover: {
    title: "State your intent",
    description:
      "Type any DeFi action in plain language — “swap 10 SUI to USDC”, “send 5 USDC to alice”, “lend 100 USDC” — or chain several into one flow.",
    side: "top",
    align: "start",
  },
};

const sendStep: DriveStep = {
  element: '[data-tour="send"]',
  popover: {
    title: "Send it — the Guardian has your back",
    description:
      "The copilot builds one unsigned transaction and the Guardian inspects it before you sign. Fail-closed: if anything's off, it blocks — no prompt, no fee.",
    side: "top",
    align: "end",
  },
};

const sidebarNavStep: DriveStep = {
  element: '[data-tour="sidebar-nav"]',
  popover: {
    title: "Explore everything",
    description:
      "Jump to your Dashboard (XP, badges, receipts), the Network view, your Memory, or the cross-chain Bridge.",
    side: "right",
    align: "start",
  },
};

const menuToggleStep: DriveStep = {
  element: '[data-tour="menu-toggle"]',
  popover: {
    title: "Find your way around",
    description:
      "Tap here to open navigation — your Dashboard, the Network view, Memory, and the Bridge all live in the menu.",
    side: "bottom",
    align: "start",
  },
};

const friendListStep: DriveStep = {
  element: '[data-tour="friend-list"]',
  popover: {
    title: "Save contacts",
    description:
      "Add friends so you can just say “send 1 SUI to @alice” — no pasting long addresses.",
    side: "bottom",
    align: "end",
  },
};

const settingsStep: DriveStep = {
  element: '[data-tour="settings"]',
  popover: {
    title: "You're ready 🚀",
    description:
      "See every supported protocol here. That's the tour — go ahead and type your first intent!",
    side: "bottom",
    align: "end",
  },
};

export function buildTourSteps({ isMobile }: { isMobile: boolean }): DriveStep[] {
  const navStep = isMobile ? menuToggleStep : sidebarNavStep;
  return [introStep, composerStep, sendStep, navStep, friendListStep, settingsStep];
}
