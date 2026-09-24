"use client";

import { useSyncExternalStore } from "react";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Still awake" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const noSubscribe = () => () => {};

// Uses the reader's clock, not the server's.
export function Greeting({ name }: { name: string }) {
  const hello = useSyncExternalStore(noSubscribe, greeting, () => "Hello");
  return (
    <>
      {hello}, {name}
    </>
  );
}
