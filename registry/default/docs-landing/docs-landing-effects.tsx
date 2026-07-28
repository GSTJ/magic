"use client";

import type { CSSProperties, ReactNode } from "react";

import { useLayoutEffect, useRef } from "react";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type DocsLandingEffectsProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export const DocsLandingEffects = ({
  children,
  className,
  style,
}: DocsLandingEffectsProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger);

    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const hero = root.querySelector<HTMLElement>("[data-docs-hero]");
        if (hero) {
          const heroCopy = hero.querySelectorAll<HTMLElement>(
            "[data-docs-hero-reveal]",
          );
          const heroVisual =
            hero.querySelector<HTMLElement>("[data-docs-visual]");
          const timeline = gsap.timeline({
            defaults: { duration: 0.76, ease: "power3.out" },
          });

          timeline.from(heroCopy, {
            autoAlpha: 0,
            stagger: 0.09,
            y: 24,
          });

          if (heroVisual) {
            timeline.from(
              heroVisual,
              {
                autoAlpha: 0,
                clipPath: "inset(0 0 100% 0)",
                duration: 1,
                ease: "expo.out",
                onComplete: () =>
                  gsap.set(heroVisual, { clearProps: "clipPath" }),
              },
              0.16,
            );
          }
        }

        const sections = gsap.utils.toArray<HTMLElement>(
          "[data-docs-section]",
          root,
        );

        for (const section of sections) {
          const targets =
            section.querySelectorAll<HTMLElement>("[data-docs-reveal]");
          if (targets.length > 0) {
            gsap.from(targets, {
              autoAlpha: 0,
              duration: 0.78,
              ease: "power3.out",
              scrollTrigger: {
                invalidateOnRefresh: true,
                once: true,
                start: "top 76%",
                trigger: section,
              },
              stagger: 0.1,
              y: 28,
            });
          }

          const rule = section.querySelector<HTMLElement>("[data-docs-rule]");
          if (rule) {
            gsap.fromTo(
              rule,
              { scaleX: 0, transformOrigin: "left center" },
              {
                ease: "none",
                scaleX: 1,
                scrollTrigger: {
                  end: "top 34%",
                  scrub: 0.7,
                  start: "top 94%",
                  trigger: section,
                },
              },
            );
          }
        }
      });

      media.add(
        "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
        () => {
          const floating = [
            ...root.querySelectorAll<HTMLElement>("[data-docs-float]"),
          ];
          if (floating.length === 0) return;

          const movers = floating.map((target) => ({
            moveX: gsap.quickTo(target, "x", {
              duration: 0.55,
              ease: "power3.out",
            }),
            moveY: gsap.quickTo(target, "y", {
              duration: 0.55,
              ease: "power3.out",
            }),
            target,
          }));

          const move = (event: PointerEvent) => {
            const x = event.clientX / window.innerWidth - 0.5;
            const y = event.clientY / window.innerHeight - 0.5;

            for (const mover of movers) {
              const strength = Number(mover.target.dataset.docsFloat ?? 12);
              mover.moveX(x * strength);
              mover.moveY(y * strength);
            }
          };

          const reset = () => {
            for (const mover of movers) {
              mover.moveX(0);
              mover.moveY(0);
            }
          };

          root.addEventListener("pointerleave", reset);
          root.addEventListener("pointermove", move);

          return () => {
            root.removeEventListener("pointerleave", reset);
            root.removeEventListener("pointermove", move);
            gsap.killTweensOf(floating);
            gsap.set(floating, { clearProps: "transform" });
          };
        },
      );
    }, root);

    return () => {
      media.revert();
      context.revert();
    };
  }, []);

  return (
    <div className={className} ref={rootRef} style={style}>
      {children}
    </div>
  );
};
