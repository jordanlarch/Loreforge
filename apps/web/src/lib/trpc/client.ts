"use client";

import {
  createTRPCReact,
  type CreateTRPCReact,
} from "@trpc/react-query";

import type { AppRouter } from "@/server/trpc/root";

export const trpc: CreateTRPCReact<AppRouter, unknown> =
  createTRPCReact<AppRouter>();
