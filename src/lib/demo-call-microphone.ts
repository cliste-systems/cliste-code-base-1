import {
  createLocalAudioTrack,
  type LocalAudioTrack,
  type Room,
  Track,
} from "livekit-client";

let preflightMicStream: MediaStream | null = null;

/** Request mic permission on the Start button click (user gesture). */
export async function ensureMicrophoneAccess(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }

  preflightMicStream?.getTracks().forEach((track) => track.stop());
  preflightMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
}

export function releasePreflightMicrophone(): void {
  preflightMicStream?.getTracks().forEach((track) => track.stop());
  preflightMicStream = null;
}

function existingMicrophoneTrack(room: Room): LocalAudioTrack | null {
  const publication = room.localParticipant.getTrackPublication(
    Track.Source.Microphone,
  );
  const track = publication?.track;
  return track?.kind === Track.Kind.Audio ? (track as LocalAudioTrack) : null;
}

export async function publishDemoCallMicrophone(
  room: Room,
): Promise<LocalAudioTrack> {
  releasePreflightMicrophone();

  const existing = existingMicrophoneTrack(room);
  if (existing && room.localParticipant.isMicrophoneEnabled) {
    return existing;
  }

  await room.localParticipant.setMicrophoneEnabled(false);

  const track = await createLocalAudioTrack({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  await room.localParticipant.publishTrack(track, {
    source: Track.Source.Microphone,
  });
  await room.localParticipant.setMicrophoneEnabled(true);

  return track;
}

export async function unpublishDemoCallMicrophone(room: Room): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(
    Track.Source.Microphone,
  );
  if (publication?.track) {
    await room.localParticipant.unpublishTrack(publication.track, true);
  }
  await room.localParticipant.setMicrophoneEnabled(false);
}
