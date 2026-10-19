"use client";

import { useEffect } from "react";
import { getGsap, MOTION_CONDITIONS } from "@/lib/motion/gsap";

/** Max tilt (degrees) applied to the card while the pointer moves over it. */
const TILT_DEGREES = 5;
/** Max parallax offset (px) applied to the product image. */
const PARALLAX_PX = 10;

/**
 * Attach GSAP-driven motion to a product card:
 *  - scroll reveal (fade + rise) staggered by grid index, played once
 *  - pointer tilt and image parallax on hover-capable devices
 * All effects honour `prefers-reduced-motion`.
 *
 * @param {{
 *   cardRef: import("react").RefObject<HTMLElement | null>,
 *   mediaRef: import("react").RefObject<HTMLElement | null>,
 *   index?: number,
 * }} params Refs to the card root and the image wrapper, plus the grid index.
 * @returns {void}
 */
export function useProductCardMotion({ cardRef, mediaRef, index = 0 }) {
  useEffect(() => {
    const gsap = getGsap();
    const card = cardRef.current;
    const media = mediaRef.current;
    if (!gsap || !card) return undefined;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MOTION_CONDITIONS.motionOk, () => {
        gsap.fromTo(
          card,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            delay: (index % 4) * 0.07,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 92%", once: true },
          }
        );
      });

      mm.add(MOTION_CONDITIONS.hoverMotion, () => {
        if (!media) return undefined;

        gsap.set(card, { transformPerspective: 900, transformOrigin: "center" });
        const quick = { duration: 0.45, ease: "power3.out" };
        const rotateX = gsap.quickTo(card, "rotationX", quick);
        const rotateY = gsap.quickTo(card, "rotationY", quick);
        const lift = gsap.quickTo(card, "y", quick);
        const mediaX = gsap.quickTo(media, "x", quick);
        const mediaY = gsap.quickTo(media, "y", quick);

        /** @param {PointerEvent} event */
        const onMove = (event) => {
          const rect = card.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width - 0.5;
          const py = (event.clientY - rect.top) / rect.height - 0.5;
          rotateY(px * TILT_DEGREES * 2);
          rotateX(-py * TILT_DEGREES * 2);
          mediaX(px * PARALLAX_PX * 2);
          mediaY(py * PARALLAX_PX * 2);
        };
        const onEnter = () => {
          lift(-4);
          gsap.to(media, { scale: 1.06, duration: 0.5, ease: "power3.out" });
        };
        const onLeave = () => {
          rotateX(0);
          rotateY(0);
          lift(0);
          mediaX(0);
          mediaY(0);
          gsap.to(media, { scale: 1, duration: 0.5, ease: "power3.out" });
        };

        card.addEventListener("pointerenter", onEnter);
        card.addEventListener("pointermove", onMove);
        card.addEventListener("pointerleave", onLeave);
        return () => {
          card.removeEventListener("pointerenter", onEnter);
          card.removeEventListener("pointermove", onMove);
          card.removeEventListener("pointerleave", onLeave);
        };
      });
    }, card);

    return () => ctx.revert();
  }, [cardRef, mediaRef, index]);
}

/**
 * Play the add-to-cart feedback: button pop, image bounce and a floating "+1" chip.
 * No-op on the server or when the user prefers reduced motion.
 *
 * @param {{
 *   button: HTMLElement | null,
 *   bounce: HTMLElement | null,
 *   chip: HTMLElement | null,
 * }} targets Elements to animate; any may be null.
 * @returns {void}
 */
export function playAddToCartFeedback({ button, bounce, chip }) {
  const gsap = getGsap();
  if (!gsap) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const tl = gsap.timeline();
  if (button) {
    tl.fromTo(button, { scale: 0.86 }, { scale: 1, duration: 0.55, ease: "back.out(3)" }, 0);
  }
  if (bounce) {
    tl.fromTo(bounce, { y: 0 }, { y: -8, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1 }, 0);
  }
  if (chip) {
    tl.fromTo(
      chip,
      { autoAlpha: 0, y: 4, scale: 0.8 },
      { autoAlpha: 1, y: -24, scale: 1, duration: 0.4, ease: "power3.out" },
      0
    ).to(chip, { autoAlpha: 0, y: -36, duration: 0.3, ease: "power2.in" }, ">0.2");
  }
}
