// Toolbar buttons and keyboard shortcuts.
import { PRESET_NAMES } from "./presets.js";

export function bindToolbar({ onPreset, onToggleDslr, onToggleDepthOfField }) {
  const dslrButton = document.getElementById("btn-dslr");
  const depthOfFieldButton = document.getElementById("btn-dof");
  const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));
  dslrButton.addEventListener("click", onToggleDslr);
  depthOfFieldButton.addEventListener("click", onToggleDepthOfField);
  for (const button of presetButtons) {
    button.addEventListener("click", () => onPreset(button.dataset.preset));
  }
  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const presetIndex = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
    if (presetIndex >= 0) {
      onPreset(PRESET_NAMES[presetIndex]);
    } else if (event.code === "KeyF") {
      onToggleDepthOfField();
    } else if (event.code === "KeyC") {
      onToggleDslr();
    }
  });
  return {
    showPreset(name) {
      for (const button of presetButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.preset === name));
      }
    },
    showToggles(dslrEnabled, depthOfFieldEnabled) {
      dslrButton.setAttribute("aria-pressed", String(dslrEnabled));
      depthOfFieldButton.setAttribute("aria-pressed", String(depthOfFieldEnabled));
    },
  };
}
