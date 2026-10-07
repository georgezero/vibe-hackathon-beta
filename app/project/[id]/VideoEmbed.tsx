import { detectVideo } from "@/lib/video";

interface Props {
  url: string;
  title: string;
}

export function VideoEmbed({ url, title }: Props) {
  const video = detectVideo(url);

  if (!video) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
      >
        ▶ Open Demo Video ↗
      </a>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        borderRadius: 10,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <iframe
        src={video.embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}
