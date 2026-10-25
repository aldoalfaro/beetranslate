"use client";

import { forwardRef, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  minHeight?: number;
};

export const FittedTextarea = forwardRef<HTMLTextAreaElement, Props>(function FittedTextarea(
  { minHeight = 0, value, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = innerRef.current;
    if (!element) return;
    const parent = element.parentElement;

    const fit = () => {
      element.style.minHeight = "0px";
      element.style.height = "0px";
      const next = Math.max(element.scrollHeight, minHeight);
      element.style.minHeight = "";
      element.style.height = `${next}px`;
    };

    fit();
    if (!parent) return;

    element.dataset.fitWidth = String(parent.clientWidth);
    const observer = new ResizeObserver(() => {
      const width = String(parent.clientWidth);
      if (element.dataset.fitWidth === width) return;
      element.dataset.fitWidth = width;
      fit();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [value, minHeight]);

  return (
    <textarea
      {...props}
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      rows={1}
      value={value}
    />
  );
});
