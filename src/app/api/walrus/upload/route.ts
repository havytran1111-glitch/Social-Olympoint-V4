import { NextResponse } from "next/server";
import { WalrusClient, WalrusFile } from "@mysten/walrus";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/sui/utils";

const suiClient = new SuiClient({
  url: getFullnodeUrl("testnet"),
});

const walrusClient = new WalrusClient({
  suiClient,
  network: "testnet",
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const walrusFile = WalrusFile.from({
      contents: buffer,
      identifier: `${Date.now()}-${file.name}`,
      tags: {
        "content-type": file.type,
      },
    });

    const keypair = Ed25519Keypair.fromSecretKey(
      fromB64(process.env.SUI_PRIVATE_KEY!)
    );

    const result = await walrusClient.writeFiles({
      files: [walrusFile],
      signer: keypair,
      epochs: 10,
      deletable: false,
    });

    if (!result || result.length === 0 || !result[0].blobObject) {
      throw new Error("Walrus upload failed");
    }

    const blobId = result[0].blobObject.blob_id;
    const imageUrl = `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`;

    return NextResponse.json({
      success: true,
      blobId,
      imageUrl,
    });
  } catch (err) {
    console.error("Walrus upload error:", err);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
