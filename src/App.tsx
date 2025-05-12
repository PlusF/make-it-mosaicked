import React from "react";
import "./App.css";

function App() {
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [mosaicSize, setMosaicSize] = React.useState<number>(10);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isSelecting, setIsSelecting] = React.useState<boolean>(false);
  const [selectionStart, setSelectionStart] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [originalImageData, setOriginalImageData] =
    React.useState<ImageData | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        // 新しい画像がアップロードされたら選択状態をリセット
        setSelectionStart(null);
        setSelectionEnd(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // クリップボードからの画像貼り付け処理
  const handlePaste = React.useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setSelectedImage(e.target?.result as string);
            // 新しい画像が貼り付けられたら選択状態をリセット
            setSelectionStart(null);
            setSelectionEnd(null);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  }, []);

  // ペーストイベントのリスナーを設定・解除
  React.useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  // 画像読み込み時に原画像を保存
  React.useEffect(() => {
    if (selectedImage && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        // 原画像データを保存
        setOriginalImageData(
          ctx.getImageData(0, 0, canvas.width, canvas.height)
        );
      };
      img.src = selectedImage;
    }
  }, [selectedImage]);

  // 選択範囲を描画
  React.useEffect(() => {
    if (!canvasRef.current || !originalImageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // 画像を元に戻す
    ctx.putImageData(originalImageData, 0, 0);

    // 選択範囲を描画
    if (selectionStart && selectionEnd) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;

      const width = selectionEnd.x - selectionStart.x;
      const height = selectionEnd.y - selectionStart.y;

      ctx.strokeRect(selectionStart.x, selectionStart.y, width, height);
    }
  }, [selectionStart, selectionEnd, originalImageData]);

  // キャンバス上のマウス座標を取得する（スケーリングを考慮）
  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // クライアント座標をキャンバス座標に変換（スケーリングを考慮）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const coords = getCanvasCoordinates(e);

    setIsSelecting(true);
    setSelectionStart(coords);
    setSelectionEnd(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !canvasRef.current) return;

    const coords = getCanvasCoordinates(e);
    setSelectionEnd(coords);
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const resetSelection = () => {
    if (!canvasRef.current || !originalImageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // 画像を元に戻す
    ctx.putImageData(originalImageData, 0, 0);

    // 選択状態をリセット
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const applyMosaic = () => {
    if (!selectedImage || !canvasRef.current || !originalImageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // 画像を元に戻す
    ctx.putImageData(originalImageData, 0, 0);

    // 選択範囲がない場合は画像全体にモザイクをかける
    if (!selectionStart || !selectionEnd) {
      applyMosaicToWholeImage();
      return;
    }

    // 選択範囲の座標を正規化（開始点が常に左上になるように）
    const startX = Math.floor(Math.min(selectionStart.x, selectionEnd.x));
    const startY = Math.floor(Math.min(selectionStart.y, selectionEnd.y));
    const endX = Math.ceil(Math.max(selectionStart.x, selectionEnd.x));
    const endY = Math.ceil(Math.max(selectionStart.y, selectionEnd.y));
    const width = endX - startX;
    const height = endY - startY;

    // 範囲チェック
    if (width <= 0 || height <= 0) {
      console.warn("Invalid selection size:", width, height);
      return;
    }

    try {
      // 選択範囲のイメージデータを取得
      const imageData = ctx.getImageData(startX, startY, width, height);
      const data = imageData.data;

      // 平均色計算のためのバッファ
      let sumR, sumG, sumB, count;

      // モザイク処理
      for (let y = 0; y < height; y += mosaicSize) {
        for (let x = 0; x < width; x += mosaicSize) {
          // 各ブロックの平均色を計算
          sumR = sumG = sumB = count = 0;

          // ブロック内のピクセルの平均を取る
          for (let my = 0; my < mosaicSize && y + my < height; my++) {
            for (let mx = 0; mx < mosaicSize && x + mx < width; mx++) {
              const index = ((y + my) * width + (x + mx)) * 4;
              sumR += data[index];
              sumG += data[index + 1];
              sumB += data[index + 2];
              count++;
            }
          }

          // 平均色の計算
          const avgR = Math.round(sumR / count);
          const avgG = Math.round(sumG / count);
          const avgB = Math.round(sumB / count);

          // ブロック内の全ピクセルを平均色で塗る
          for (let my = 0; my < mosaicSize && y + my < height; my++) {
            for (let mx = 0; mx < mosaicSize && x + mx < width; mx++) {
              const index = ((y + my) * width + (x + mx)) * 4;
              data[index] = avgR;
              data[index + 1] = avgG;
              data[index + 2] = avgB;
            }
          }
        }
      }

      // 処理したイメージデータを描画
      ctx.putImageData(imageData, startX, startY);

      // 更新された画像データ全体を保存
      setOriginalImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));

      // 選択状態をリセット
      setSelectionStart(null);
      setSelectionEnd(null);
    } catch (error) {
      console.error("Error during mosaic processing:", error);
      // エラーが発生した場合は元の画像に戻す
      ctx.putImageData(originalImageData, 0, 0);
    }
  };

  const applyMosaicToWholeImage = () => {
    if (!selectedImage || !canvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      // キャンバスのサイズを画像に合わせる
      canvas.width = img.width;
      canvas.height = img.height;

      // 画像を描画
      ctx.drawImage(img, 0, 0);

      // モザイク処理
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 平均色計算のためのバッファ
      let sumR, sumG, sumB, count;

      for (let y = 0; y < canvas.height; y += mosaicSize) {
        for (let x = 0; x < canvas.width; x += mosaicSize) {
          // 各ブロックの平均色を計算
          sumR = sumG = sumB = count = 0;

          // ブロック内のピクセルの平均を取る
          for (let my = 0; my < mosaicSize && y + my < canvas.height; my++) {
            for (let mx = 0; mx < mosaicSize && x + mx < canvas.width; mx++) {
              const index = ((y + my) * canvas.width + (x + mx)) * 4;
              sumR += data[index];
              sumG += data[index + 1];
              sumB += data[index + 2];
              count++;
            }
          }

          // 平均色の計算
          const avgR = Math.round(sumR / count);
          const avgG = Math.round(sumG / count);
          const avgB = Math.round(sumB / count);

          // ブロック内の全ピクセルを平均色で塗る
          for (let my = 0; my < mosaicSize && y + my < canvas.height; my++) {
            for (let mx = 0; mx < mosaicSize && x + mx < canvas.width; mx++) {
              const index = ((y + my) * canvas.width + (x + mx)) * 4;
              data[index] = avgR;
              data[index + 1] = avgG;
              data[index + 2] = avgB;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // 更新された画像データを保存
      setOriginalImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.src = selectedImage;
  };

  const saveImage = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // canvasの内容をDataURLとして取得
    const dataURL = canvas.toDataURL("image/png");

    // ダウンロード用のリンクを作成
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "mosaic-image.png";

    // リンクをクリックしてダウンロードを開始
    document.body.appendChild(a);
    a.click();

    // 不要になったリンク要素を削除
    document.body.removeChild(a);
  };

  return (
    <div className="app">
      <h1>freee mosaic</h1>
      <div className="controls">
        <div className="instructions">
          <p>
            画像をアップロードするか、クリップボードから画像を貼り付けてください（Ctrl+V
            または Command+V）。
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="file-input"
        />
        <div className="preview">
          {selectedImage && (
            <canvas
              ref={canvasRef}
              className="canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          )}
        </div>
        <div className="mosaic-controls">
          <label>
            モザイクサイズ:
            <input
              type="range"
              min="5"
              max="50"
              value={mosaicSize}
              onChange={(e) => setMosaicSize(Number(e.target.value))}
            />
            {mosaicSize}px
          </label>
          <div className="button-hstack">
            <button onClick={applyMosaic} disabled={!selectedImage}>
              モザイクを適用
            </button>
            {selectionStart && selectionEnd && (
              <button onClick={resetSelection}>選択をリセット</button>
            )}
            <button onClick={saveImage} disabled={!selectedImage}>
              画像を保存
            </button>
          </div>
        </div>
      </div>
      {selectedImage && (
        <div className="instructions">
          <p>モザイクをかけたい領域をマウスでドラッグして選択してください。</p>
          <p>
            何も選択せずに「モザイクを適用」を押すと、画像全体にモザイクがかかります。
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
