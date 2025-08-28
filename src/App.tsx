import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  FileInput,
  Grid,
  Group,
  Notification,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconRefresh,
  IconSparkles,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import React from "react";

function App() {
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [mosaicSize, setMosaicSize] = React.useState<number>(10);
  const [mosaicSizeOption, setMosaicSizeOption] = React.useState<string>("中");
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
  const [showCopySuccess, setShowCopySuccess] = React.useState<boolean>(false);

  const mosaicSizeOptions = {
    小: 8,
    中: 16,
    大: 32,
    特大: 64,
  };

  const handleMosaicSizeChange = (option: string) => {
    setMosaicSizeOption(option);
    setMosaicSize(mosaicSizeOptions[option as keyof typeof mosaicSizeOptions]);
  };

  const handleImageUpload = (file: File | null) => {
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setSelectionStart(null);
        setSelectionEnd(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = React.useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          setFileName("clipboard-image.png");
          const reader = new FileReader();
          reader.onload = (e) => {
            setSelectedImage(e.target?.result as string);
            setSelectionStart(null);
            setSelectionEnd(null);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  React.useEffect(() => {
    if (selectedImage && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        setOriginalImageData(
          ctx.getImageData(0, 0, canvas.width, canvas.height)
        );
      };
      img.src = selectedImage;
    }
  }, [selectedImage]);

  React.useEffect(() => {
    if (!canvasRef.current || !originalImageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    ctx.putImageData(originalImageData, 0, 0);

    if (selectionStart && selectionEnd) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;

      const width = selectionEnd.x - selectionStart.x;
      const height = selectionEnd.y - selectionStart.y;

      ctx.strokeRect(selectionStart.x, selectionStart.y, width, height);
    }
  }, [selectionStart, selectionEnd, originalImageData]);

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

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

    ctx.putImageData(originalImageData, 0, 0);

    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const applyMosaic = () => {
    if (!selectedImage || !canvasRef.current || !originalImageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    ctx.putImageData(originalImageData, 0, 0);

    if (!selectionStart || !selectionEnd) {
      applyMosaicToRegion(0, 0, canvas.width, canvas.height);
      return;
    }

    const startX = Math.floor(Math.min(selectionStart.x, selectionEnd.x));
    const startY = Math.floor(Math.min(selectionStart.y, selectionEnd.y));
    const endX = Math.ceil(Math.max(selectionStart.x, selectionEnd.x));
    const endY = Math.ceil(Math.max(selectionStart.y, selectionEnd.y));
    const width = endX - startX;
    const height = endY - startY;

    if (width <= 0 || height <= 0) {
      console.warn("Invalid selection size:", width, height);
      return;
    }

    applyMosaicToRegion(startX, startY, width, height);

    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const applyMosaicToRegion = (
    startX: number,
    startY: number,
    width: number,
    height: number
  ) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    try {
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d")!;

      // ピクセルサイズから縮小後のサイズを計算
      const mosaicCountX = Math.ceil(width / mosaicSize);
      const mosaicCountY = Math.ceil(height / mosaicSize);

      tempCanvas.width = mosaicCountX;
      tempCanvas.height = mosaicCountY;

      // 元画像を縮小
      tempCtx.drawImage(
        canvas,
        startX,
        startY,
        width,
        height,
        0,
        0,
        mosaicCountX,
        mosaicCountY
      );

      // 縮小画像を元のサイズに拡大（補間なし）
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        mosaicCountX,
        mosaicCountY,
        startX,
        startY,
        width,
        height
      );

      setOriginalImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } catch (error) {
      console.error("Error during mosaic processing:", error);
      if (originalImageData) {
        ctx.putImageData(originalImageData, 0, 0);
      }
    }
  };

  const saveImage = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const dataURL = canvas.toDataURL("image/png");

    const a = document.createElement("a");
    a.href = dataURL;

    if (fileName) {
      const nameWithoutExtension =
        fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
      const extension = fileName.substring(fileName.lastIndexOf(".")) || ".png";
      a.download = `${nameWithoutExtension}_mosaicked${extension}`;
    } else {
      a.download = "image_mosaicked.png";
    }

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
  };

  const copyToClipboard = async () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png");
      });

      if (blob) {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);

        setShowCopySuccess(true);

        setTimeout(() => {
          setShowCopySuccess(false);
        }, 3000);
      }
    } catch (error) {
      console.error("クリップボードへのコピーに失敗しました:", error);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setFileName(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setOriginalImageData(null);
  };

  return (
    <Container size="xl" py="md">
      <Stack>
        <Title order={1} c="blue.7" ta="center" mb="md">
          Make It Mosaicked
        </Title>

        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack>
              <Card withBorder>
                <Stack>
                  <Text fw={500} size="sm">
                    使い方
                  </Text>
                  <Text size="xs" c="dimmed">
                    画像をアップロードするか、クリップボードから画像を貼り付けてください
                    （Ctrl+V または Command+V）
                  </Text>
                  <Text size="xs" c="dimmed">
                    モザイクをかけたい領域をマウスでドラッグして選択してください。
                    何も選択せずに「モザイクを適用」を押すと、画像全体にモザイクがかかります。
                  </Text>
                </Stack>
              </Card>
              {selectedImage && (
                <>
                  <Card withBorder>
                    <Stack>
                      <Text fw={500} size="sm">
                        モザイクサイズ
                      </Text>
                      <Group gap="md" align="center">
                        {Object.entries(mosaicSizeOptions).map(
                          ([label, size]) => (
                            <Box
                              key={label}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                                opacity: mosaicSizeOption === label ? 1 : 0.6,
                                transition: "all 0.2s ease",
                              }}
                              onClick={() => handleMosaicSizeChange(label)}
                            >
                              <Box
                                style={{
                                  width: 48,
                                  height: 48,
                                  backgroundImage: `linear-gradient(45deg, #868e96 25%, transparent 25%, transparent 75%, #868e96 75%),
                                                     linear-gradient(45deg, #868e96 25%, transparent 25%, transparent 75%, #868e96 75%)`,
                                  backgroundColor: "#dee2e6",
                                  backgroundPosition: `0 0, ${size / 2}px ${
                                    size / 2
                                  }px`,
                                  backgroundSize: `${size}px ${size}px`,
                                  borderRadius: 4,
                                  border:
                                    mosaicSizeOption === label
                                      ? "2px solid var(--mantine-color-blue-5)"
                                      : "2px solid var(--mantine-color-gray-3)",
                                }}
                              />
                              <Text
                                size="xs"
                                fw={mosaicSizeOption === label ? 600 : 400}
                                c={
                                  mosaicSizeOption === label
                                    ? "blue.6"
                                    : "dimmed"
                                }
                              >
                                {label}
                              </Text>
                              <Text
                                size="xs"
                                c="dimmed"
                                style={{ fontSize: 10 }}
                              >
                                {size}px
                              </Text>
                            </Box>
                          )
                        )}
                      </Group>
                    </Stack>
                  </Card>

                  <Divider />

                  <Stack>
                    <Button
                      leftSection={<IconRefresh />}
                      variant="default"
                      disabled={!selectionStart || !selectionEnd}
                      onClick={resetSelection}
                      fullWidth
                    >
                      選択をリセット
                    </Button>

                    <Button
                      leftSection={<IconSparkles />}
                      onClick={applyMosaic}
                      disabled={!selectedImage}
                      fullWidth
                    >
                      {selectionStart && selectionEnd
                        ? "選択範囲にモザイクを適用"
                        : "画像全体にモザイクを適用"}
                    </Button>

                    <Button
                      leftSection={<IconDeviceFloppy />}
                      variant="light"
                      onClick={saveImage}
                      disabled={!selectedImage}
                      fullWidth
                    >
                      画像を保存
                    </Button>

                    <Button
                      leftSection={<IconCopy />}
                      variant="light"
                      onClick={copyToClipboard}
                      disabled={!selectedImage}
                      fullWidth
                    >
                      クリップボードにコピー
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            {!selectedImage ? (
              <Paper h={400} withBorder radius="md" p="md">
                <Stack h="100%" justify="center" align="center" gap="lg">
                  <Stack align="center" gap="xs">
                    <Text size="lg" c="dimmed" ta="center">
                      画像を選択して開始
                    </Text>
                    <Text size="sm" c="dimmed" ta="center">
                      またはクリップボードから貼り付け（Ctrl+V / Cmd+V）
                    </Text>
                  </Stack>
                  <FileInput
                    placeholder="画像を選択"
                    leftSection={<IconUpload />}
                    accept="image/*"
                    onChange={handleImageUpload}
                    w={250}
                    variant="filled"
                  />
                </Stack>
              </Paper>
            ) : (
              <Paper bg="gray.0" h="100%" radius="md" p={45} pos="relative">
                <ActionIcon
                  variant="outline"
                  color="gray.5"
                  size="lg"
                  radius="sm"
                  pos="absolute"
                  top={8}
                  right={8}
                  onClick={clearImage}
                  style={{ zIndex: 10 }}
                >
                  <IconX size={20} />
                </ActionIcon>
                {fileName && (
                  <Text
                    size="xs"
                    c="dimmed"
                    pos="absolute"
                    bottom={8}
                    right={8}
                    style={{ zIndex: 10 }}
                  >
                    {`${originalImageData?.width}px x ${originalImageData?.height}px ${fileName}`}
                  </Text>
                )}
                <Center h="100%">
                  <Box
                    component="canvas"
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    maw="100%"
                    mah="100%"
                    style={{
                      display: "block",
                      width: "auto",
                      height: "auto",
                      cursor: "crosshair",
                    }}
                  />
                </Center>
              </Paper>
            )}
          </Grid.Col>
        </Grid>
      </Stack>

      {showCopySuccess && (
        <Notification
          icon={<IconCheck />}
          color="teal"
          title="成功"
          onClose={() => setShowCopySuccess(false)}
          pos="fixed"
          bottom={20}
          right={20}
          style={{ zIndex: 1000 }}
        >
          画像をクリップボードにコピーしました
        </Notification>
      )}
    </Container>
  );
}

export default App;
