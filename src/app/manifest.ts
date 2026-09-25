import type { MetadataRoute } from "next";
import { WEB_APP_MANIFEST } from "@/lib/pwa/manifest";

const SHARE_TARGET: MetadataRoute.Manifest["share_target"] = {
  action: "/api/capture/share",
  method: "POST",
  enctype: "multipart/form-data",
  params: {
    title: "title",
    text: "text",
    url: "url",
  },
};

export default function manifest(): MetadataRoute.Manifest {
  return {
    ...WEB_APP_MANIFEST,
    share_target: SHARE_TARGET,
  };
}
