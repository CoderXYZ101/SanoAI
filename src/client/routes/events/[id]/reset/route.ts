import { ApiError, authed } from "@/client/http";
import { getEvent, resetEvent } from "@/lib/repo";

export const POST = authed<{ params: Promise<{ id: string }> }>(async (_req, { user, params }) => {
  const { id } = await params;
  if (!(await getEvent(user.id, id))) throw new ApiError(404, "Event not found.");
  (await resetEvent(user.id, id));
  return { event: (await getEvent(user.id, id))?.event };
});
