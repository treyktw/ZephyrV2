// types/error.ts
export type ErrorType = {
  message: string;
  code?: string;
  status?: number;
};

// lib/utils/error.ts
import { toast } from "sonner";

export function handleError(error: unknown) {
  // If error is our custom ErrorType
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return toast.error(error.message);
  }

  // If error is an Error instance
  if (error instanceof Error) {
    return toast.error(error.message);
  }

  // If error is a string
  if (typeof error === 'string') {
    return toast.error(error);
  }

  // Default error message
  return toast.error('Something went wrong');
}
