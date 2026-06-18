import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ORPC_PREFIX } from "@read-frog/definitions";
import { env } from "@/env";
const link = new RPCLink({
    url: `${env.WXT_API_URL}${ORPC_PREFIX}`,
    headers: {
        "x-orpc-source": "extension",
    },
    fetch: (request, init) => {
        return fetch(request, {
            ...init,
            credentials: "include",
        });
    },
});
export const backgroundOrpcClient = createORPCClient(link);
