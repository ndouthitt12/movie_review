import { revalidateTag } from "next/cache";

export const RECOMMENDATIONS_CACHE_TAG = "recommendations";

export function invalidateRecommendations() {
  try {
    revalidateTag(RECOMMENDATIONS_CACHE_TAG, { expire: 0 });
  } catch (error) {
    // Route unit tests invoke handlers without Next's request work store.
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    )
      return;
    throw error;
  }
}
