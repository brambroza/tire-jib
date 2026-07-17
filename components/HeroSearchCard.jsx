"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchTabs } from "@/data/home";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TAB_BY_CAR = "ตามรุ่นรถ";
const TAB_BY_SIZE = "ตามขนาดยาง";
const TAB_BY_IMAGE = "ค้นหาด้วยภาพ";

export default function HeroSearchCard() {
  const [activeTab, setActiveTab] = useState(searchTabs[0]);
  const [filters, setFilters] = useState({
    make: "",
    model: "",
    year: "",
    brand: "",
  });
  const [sizeFilters, setSizeFilters] = useState({
    width: "",
    aspect: "",
    rim: "",
  });
  const [widthOptions, setWidthOptions] = useState([]);
  const [aspectOptions, setAspectOptions] = useState([]);
  const [rimOptions, setRimOptions] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [loadingBrand, setLoadingBrand] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [loadingYear, setLoadingYear] = useState(false);
  const [loadingWidth, setLoadingWidth] = useState(false);
  const [loadingAspect, setLoadingAspect] = useState(false);
  const [loadingRim, setLoadingRim] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageSearchError, setImageSearchError] = useState("");
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [useInAppPicker, setUseInAppPicker] = useState(false);
  const [pickerField, setPickerField] = useState("");
  const [isNavigating, startNavigation] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isLineInApp = /Line/i.test(ua);
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    setUseInAppPicker(isLineInApp && isMobile);
  }, []);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const uniqueSortedNumbers = (rows, key) => {
    const values = new Set();
    (rows || []).forEach((row) => {
      const value = row?.[key];
      if (value !== null && value !== undefined) {
        values.add(value);
      }
    });
    return Array.from(values).sort((a, b) => a - b);
  };

  useEffect(() => {
    const fetchBrands = async () => {
      setLoadingBrand(true);
      const { data, error } = await supabase.from("car_brands").select("id,name").order("name");
      if (!error) {
        setBrands(data || []);
      }
      setLoadingBrand(false);


    };
    fetchBrands();
  }, [supabase]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedBrandId) {
        setModels([]);
        return;
      }
      setLoadingModel(true);
      let data = null;
      let error = null;

      const byBrandId = await supabase
        .from("car_models")
        .select("id,name")
        .eq("brand_id", selectedBrandId)
        .order("name");



      if (!byBrandId.error && Array.isArray(byBrandId.data) && byBrandId.data.length > 0) {
        data = byBrandId.data;
      } else {
        const byCarBrandId = await supabase
          .from("car_models")
          .select("id,name")
          .eq("car_brand_id", selectedBrandId)
          .order("name");

        if (
          !byCarBrandId.error &&
          Array.isArray(byCarBrandId.data) &&
          byCarBrandId.data.length > 0
        ) {
          data = byCarBrandId.data;
        } else {
          const byProductCarModels = await supabase
            .from("product_car_models")
            .select("car_model:car_models(id,name)")
            .eq("car_brand_id", selectedBrandId);

          if (!byProductCarModels.error) {
            const deduped = Array.from(
              new Map(
                (byProductCarModels.data || [])
                  .map((row) => row?.car_model)
                  .filter((model) => model?.id)
                  .map((model) => [String(model.id), model]),
              ).values(),
            ).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
            data = deduped;
          } else {
            error = byProductCarModels.error;
          }
        }
      }


      if (!error) {
        setModels(data || []);
      } else {
        setModels([]);
        console.error("fetchModels error:", error);
      }
      setLoadingModel(false);
    };
    fetchModels();
  }, [supabase, selectedBrandId]);

  useEffect(() => {
    const fetchYears = async () => {
      if (!selectedModelId) {
        setYears([]);
        return;
      }
      setLoadingYear(true);
      const { data, error } = await supabase
        .from("car_years")
        .select("year_from,year_to")
        .eq("model_id", selectedModelId)
        .order("year_from");
      if (!error) {
        const yearList = [];
        (data || []).forEach((row) => {
          for (let y = row.year_from; y <= row.year_to; y += 1) {
            yearList.push(y);
          }
        });
        const uniqueYears = Array.from(new Set(yearList)).sort((a, b) => b - a);
        setYears(uniqueYears);
      }
      setLoadingYear(false);
    };
    fetchYears();
  }, [supabase, selectedModelId]);

  useEffect(() => {
    let active = true;
    const fetchWidths = async () => {
      if (activeTab !== TAB_BY_SIZE || widthOptions.length > 0) return;
      setLoadingWidth(true);
      const { data, error } = await supabase
        .from("skus")
        .select("width_mm")
        .not("width_mm", "is", null)
        .order("width_mm");
      if (!error && active) {
        setWidthOptions(uniqueSortedNumbers(data, "width_mm"));
      }
      if (active) setLoadingWidth(false);
    };
    fetchWidths();
    return () => {
      active = false;
    };
  }, [activeTab, supabase, widthOptions.length]);

  useEffect(() => {
    let active = true;
    const widthValue = Number.parseInt(sizeFilters.width, 10);
    if (!Number.isFinite(widthValue)) {
      setAspectOptions([]);
      setRimOptions([]);
      setLoadingAspect(false);
      return undefined;
    }
    const fetchAspects = async () => {
      setLoadingAspect(true);
      const { data, error } = await supabase
        .from("skus")
        .select("aspect_ratio")
        .eq("width_mm", widthValue)
        .not("aspect_ratio", "is", null)
        .order("aspect_ratio");
      if (!error && active) {
        setAspectOptions(uniqueSortedNumbers(data, "aspect_ratio"));
      }
      if (active) setLoadingAspect(false);
    };
    fetchAspects();
    return () => {
      active = false;
    };
  }, [supabase, sizeFilters.width]);

  useEffect(() => {
    let active = true;
    const widthValue = Number.parseInt(sizeFilters.width, 10);
    const aspectValue = Number.parseInt(sizeFilters.aspect, 10);
    if (!Number.isFinite(widthValue) || !Number.isFinite(aspectValue)) {
      setRimOptions([]);
      setLoadingRim(false);
      return undefined;
    }
    const fetchRims = async () => {
      setLoadingRim(true);
      const { data, error } = await supabase
        .from("skus")
        .select("rim_inch")
        .eq("width_mm", widthValue)
        .eq("aspect_ratio", aspectValue)
        .not("rim_inch", "is", null)
        .order("rim_inch");
      if (!error && active) {
        setRimOptions(uniqueSortedNumbers(data, "rim_inch"));
      }
      if (active) setLoadingRim(false);
    };
    fetchRims();
    return () => {
      active = false;
    };
  }, [supabase, sizeFilters.width, sizeFilters.aspect]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const normalize = (value) => (value || "").trim();
    const tabParam = normalize(params.get("tab"));
    const makeParam = normalize(params.get("make"));
    const modelParam = normalize(params.get("model"));
    const yearParam = normalize(params.get("year"));
    const brandParam = normalize(params.get("brand"));
    const sizeParam = normalize(params.get("size"));
    const hasSearchState = Boolean(tabParam || makeParam || modelParam || yearParam || brandParam || sizeParam);
    if (!hasSearchState) return;

    if (searchTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }

    setFilters({
      make: makeParam,
      model: modelParam,
      year: yearParam,
      brand: brandParam || makeParam,
    });

    const sizeMatch = sizeParam.match(/^(\d+)\s*\/\s*(\d+)\s*R\s*(\d+)$/i);
    setSizeFilters(
      sizeMatch
        ? {
          width: sizeMatch[1],
          aspect: sizeMatch[2],
          rim: sizeMatch[3],
        }
        : { width: "", aspect: "", rim: "" }
    );

    setSearchError("");
  }, [searchParamsKey]);

  useEffect(() => {
    const carBrandName = String(filters.brand || filters.make || "").trim();
    if (!carBrandName || !brands.length) return;
    const matchedBrand = brands.find(
      (item) => String(item?.name || "").toLowerCase() === carBrandName.toLowerCase()
    );
    if (matchedBrand && String(matchedBrand.id) !== String(selectedBrandId)) {
      setSelectedBrandId(String(matchedBrand.id));
    }
  }, [brands, filters.brand, filters.make, selectedBrandId]);

  useEffect(() => {
    if (!filters.model || !models.length) return;
    const matchedModel = models.find(
      (item) =>
        String(item?.name || "").toLowerCase().trim() ===
        String(filters.model || "").toLowerCase().trim()
    );
    if (matchedModel && String(matchedModel.id) !== String(selectedModelId)) {
      setSelectedModelId(String(matchedModel.id));
    }
  }, [models, filters.model, selectedModelId]);

  const handleBrandChange = (value) => {
    setSelectedBrandId(value);
    const brandName =
      brands.find((item) => String(item?.id) === String(value))?.name || "";
    setFilters((prev) => ({
      ...prev,
      brand: brandName,
      make: brandName,
      model: "",
      year: "",
    }));
    setSelectedModelId("");
  };




  const handleModelChange = (value) => {
    setSelectedModelId(value);
    const modelName =
      models.find((item) => String(item?.id) === String(value))?.name || "";
    setFilters((prev) => ({
      ...prev,
      model: modelName,
      year: "",
    }));
  };




  const handleYearChange = (value) => {
    setFilters((prev) => ({ ...prev, year: value }));
  };

  const handleBrandFilterChange = (value) => {
    setFilters((prev) => ({ ...prev, brand: value }));
  };

  const handleWidthChange = (value) => {
    setSizeFilters((prev) => ({
      ...prev,
      width: value,
      aspect: "",
      rim: "",
    }));
  };

  const handleAspectChange = (value) => {
    setSizeFilters((prev) => ({
      ...prev,
      aspect: value,
      rim: "",
    }));
  };

  const handleRimChange = (value) => {
    setSizeFilters((prev) => ({
      ...prev,
      rim: value,
    }));
  };

  const openPicker = (field) => {
    const meta = pickerMeta[field];
    if (!meta || meta.disabled) return;
    setPickerField(field);
  };

  const closePicker = () => setPickerField("");

  const renderPickerTrigger = (field) => {
    const meta = pickerMeta[field];
    const selected = meta.options.find((item) => item.value === String(meta.value));
    return (
      <button
        type="button"
        className="search-picker-trigger"
        disabled={meta.disabled}
        onClick={() => openPicker(field)}
      >
        <span className={`search-picker-text ${selected ? "selected" : ""}`}>
          {selected?.label || meta.placeholder}
        </span>
        <span className="search-picker-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    );
  };

  const buildSearchHref = () => {
    const params = new URLSearchParams();
    const selectedMakeName =
      brands.find((item) => String(item?.id) === String(selectedBrandId))?.name || "";
    const selectedModelName =
      models.find((item) => String(item?.id) === String(selectedModelId))?.name || "";
    const make = String(filters.brand || filters.make || selectedMakeName).trim();
    const model = String(filters.model || selectedModelName).trim();
    const year = filters.year?.trim();
    const brand = filters.brand?.trim();

    if (activeTab === TAB_BY_SIZE) {
      const hasFullSize = Boolean(sizeFilters.width && sizeFilters.aspect && sizeFilters.rim);
      if (!hasFullSize) return { href: "", error: "กรุณาเลือกขนาดยางให้ครบทั้ง 3 ช่อง" };
      params.set("size", `${sizeFilters.width}/${sizeFilters.aspect}R${sizeFilters.rim}`);
      if (brand) params.set("brand", brand);
    } else {
      if (!make || !model) return { href: "", error: "กรุณาเลือกยี่ห้อรถและรุ่นรถก่อนค้นหา" };
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (year) params.set("year", year);
      if (brand && brand !== make) params.set("brand", brand);
    }
    params.set("tab", activeTab || TAB_BY_CAR);
    return { href: `/search?${params.toString()}`, error: "" };
  };

  const handleSearch = () => {
    if (activeTab === TAB_BY_IMAGE) return;
    const { href, error } = buildSearchHref();
    if (error) {
      setSearchError(error);
      return;
    }

    setSearchError("");
    window.dispatchEvent(new Event("search:hero-hide-mobile"));
    startNavigation(() => {
      try {
        router.push(href, { scroll: true });
      } catch {
        window.location.assign(href);
      }
    });
  };

  const handleImageFileChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageSearchError("รองรับเฉพาะไฟล์รูปภาพ");
      return;
    }
    setImageSearchError("");
    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    stopCamera();
  };

  const startCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setImageSearchError("อุปกรณ์นี้ไม่รองรับการเปิดกล้อง");
      return;
    }
    setImageSearchError("");
    setStartingCamera(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { });
        }
      });
    } catch {
      setImageSearchError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์กล้อง");
      stopCamera();
    } finally {
      setStartingCamera(false);
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setImageSearchError("ไม่พบภาพจากกล้อง");
      return;
    }
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (!width || !height) {
      setImageSearchError("กล้องยังไม่พร้อม กรุณาลองถ่ายอีกครั้ง");
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setImageSearchError("ไม่สามารถประมวลผลภาพได้");
      return;
    }
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setImageSearchError("ถ่ายภาพไม่สำเร็จ");
      return;
    }

    const capturedFile = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    handleImageFileChange(capturedFile);
  };

  const handleImageSearch = async () => {
    if (!imageFile) {
      setImageSearchError("กรุณาอัปโหลดหรือถ่ายภาพก่อนค้นหา");
      return;
    }

    setImageSearchLoading(true);
    setImageSearchError("");
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("match_count", "12");
      const response = await fetch("/api/search/image", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = payload?.detail ? `: ${payload.detail}` : "";
        const source = payload?.source ? ` [${payload.source}]` : "";
        throw new Error(`${payload?.error || "image_search_failed"}${source}${detail}`);
      }

      const skuIds = Array.isArray(payload?.sku_ids)
        ? payload.sku_ids.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const params = new URLSearchParams();
      params.set("tab", TAB_BY_IMAGE);
      if (skuIds.length > 0) {
        params.set("image_ids", skuIds.join(","));
      }
      window.dispatchEvent(new Event("search:hero-hide-mobile"));
      router.push(`/search?${params.toString()}`);
    } catch (error) {
      const raw = String(error?.message || "");
      const message = raw.includes("missing_image_embedding_api_url")
        ? "ยังไม่ได้ตั้งค่า IMAGE_EMBEDDING_API_URL"
        : raw.includes("image_search_rpc_failed")
          ? "ยังไม่ได้สร้างฟังก์ชันค้นหารูปใน Supabase (search_similar_skus_by_embedding)"
          : raw.includes("unauthorized")
            ? "API key ของ embedding ไม่ถูกต้อง"
            : raw.includes("invalid_image_type")
              ? "ไฟล์รูปไม่รองรับ (รองรับ jpg/png/webp)"
              : raw.includes("invalid_image_size")
                ? "ขนาดรูปต้องไม่เกิน 6MB"
                : `ค้นหาจากภาพไม่สำเร็จ: ${raw || "unknown_error"}`;
      setImageSearchError(message);
    } finally {
      setImageSearchLoading(false);
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSearchError("");
    if (tab !== TAB_BY_IMAGE) {
      stopCamera();
    }
    if (tab === TAB_BY_SIZE) {
      setFilters((prev) => ({ ...prev, make: "", model: "", year: "" }));
      setSelectedBrandId("");
      setSelectedModelId("");
      setModels([]);
      setYears([]);
      return;
    }

    if (tab === TAB_BY_IMAGE) {
      setFilters((prev) => ({ ...prev, make: "", model: "", year: "" }));
      setSizeFilters({ width: "", aspect: "", rim: "" });
      setSelectedBrandId("");
      setSelectedModelId("");
      setModels([]);
      setYears([]);
      return;
    }

    setSizeFilters({ width: "", aspect: "", rim: "" });
  };

  const handleClear = () => {
    setSearchError("");
    setFilters({
      make: "",
      model: "",
      year: "",
      brand: "",
    });
    setSizeFilters({
      width: "",
      aspect: "",
      rim: "",
    });
    setSelectedBrandId("");
    setSelectedModelId("");
    setModels([]);
    setYears([]);
    setImageFile(null);
    setImageSearchError("");
    stopCamera();
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl("");
    }
    router.push("/");
  };

  const selectedBrandIdFromFilters =
    brands.find(
      (item) =>
        String(item?.name || "").toLowerCase().trim() ===
        String(filters.brand || "").toLowerCase(),
    )?.id || "";

  const selectedModelIdFromFilters =
    models.find(
      (item) =>
        String(item?.name || "").toLowerCase().trim() ===
        String(filters.model || "").toLowerCase(),
    )?.id || "";
  const brandSelectValue = String(selectedBrandIdFromFilters || selectedBrandId || "");
  const modelSelectValue = String(selectedModelIdFromFilters || selectedModelId || "");
  const pickerMeta = {
    brand: {
      title: "เลือกยี่ห้อรถ",
      value: brandSelectValue,
      disabled: loadingBrand,
      placeholder: loadingBrand ? "กำลังโหลด..." : "ยี่ห้อรถ",
      options: brands.map((brand) => ({ value: String(brand.id), label: brand.name })),
      onSelect: handleBrandChange,
    },
    model: {
      title: "เลือกรุ่นรถ",
      value: modelSelectValue,
      disabled: !brandSelectValue || loadingModel,
      placeholder: brandSelectValue ? (loadingModel ? "กำลังโหลด..." : "รุ่นรถ") : "เลือกรถก่อน",
      options: models.map((model) => ({ value: String(model.id), label: model.name })),
      onSelect: handleModelChange,
    },
    width: {
      title: "เลือกหน้ากว้าง (mm)",
      value: sizeFilters.width,
      disabled: loadingWidth,
      placeholder: loadingWidth ? "กำลังโหลด..." : "หน้ากว้าง (mm)",
      options: widthOptions.map((width) => ({ value: String(width), label: String(width) })),
      onSelect: handleWidthChange,
    },
    aspect: {
      title: "เลือกแก้มยาง (%)",
      value: sizeFilters.aspect,
      disabled: !sizeFilters.width || loadingAspect,
      placeholder: sizeFilters.width
        ? loadingAspect
          ? "กำลังโหลด..."
          : "แก้มยาง (%)"
        : "เลือกหน้ากว้างก่อน",
      options: aspectOptions.map((aspect) => ({ value: String(aspect), label: String(aspect) })),
      onSelect: handleAspectChange,
    },
    rim: {
      title: "เลือกขนาดล้อ (นิ้ว)",
      value: sizeFilters.rim,
      disabled: !sizeFilters.aspect || loadingRim,
      placeholder: sizeFilters.aspect
        ? loadingRim
          ? "กำลังโหลด..."
          : "ขนาดล้อ (นิ้ว)"
        : "เลือกแก้มยางก่อน",
      options: rimOptions.map((rim) => ({ value: String(rim), label: String(rim) })),
      onSelect: handleRimChange,
    },
  };

  useEffect(() => {
    if (!selectedBrandIdFromFilters) return;
    if (String(selectedBrandIdFromFilters) === String(selectedBrandId)) return;
    setSelectedBrandId(String(selectedBrandIdFromFilters));
  }, [selectedBrandIdFromFilters, selectedBrandId]);


  return (
    <div className="search-card">
      <div className="search-card-head">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <div>
          <div className="search-card-title">ค้นหายางที่ใช่สำหรับรถคุณ</div>
          <div className="search-card-sub">เลือกตามรุ่นรถ ขนาดยาง หรือค้นหาด้วยภาพ</div>
        </div>
      </div>
      <div className="search-tabs">
        {searchTabs.map((tab) => (
          <div
            key={tab}
            className={`search-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => handleTabSwitch(tab)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                handleTabSwitch(tab);
              }
            }}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="search-body">
        {activeTab === TAB_BY_SIZE ? (
          <>
            <div className="search-row search-row3">
              {useInAppPicker ? (
                <>
                  {renderPickerTrigger("width")}
                  {renderPickerTrigger("aspect")}
                  {renderPickerTrigger("rim")}
                </>
              ) : (
                <>
                  <select
                    className="sel"
                    value={sizeFilters.width}
                    onChange={(event) => handleWidthChange(event.target.value)}
                    disabled={loadingWidth}
                  >
                    <option value="">{loadingWidth ? "กำลังโหลด..." : "หน้ากว้าง (mm)"}</option>
                    {widthOptions.map((width) => (
                      <option key={width} value={String(width)}>
                        {width}
                      </option>
                    ))}
                  </select>
                  <select
                    className="sel"
                    value={sizeFilters.aspect}
                    onChange={(event) => handleAspectChange(event.target.value)}
                    disabled={!sizeFilters.width || loadingAspect}
                  >
                    <option value="">
                      {sizeFilters.width
                        ? loadingAspect
                          ? "กำลังโหลด..."
                          : "แก้มยาง (%)"
                        : "เลือกหน้ากว้างก่อน"}
                    </option>
                    {aspectOptions.map((aspect) => (
                      <option key={aspect} value={String(aspect)}>
                        {aspect}
                      </option>
                    ))}
                  </select>
                  <select
                    className="sel"
                    value={sizeFilters.rim}
                    onChange={(event) => handleRimChange(event.target.value)}
                    disabled={!sizeFilters.aspect || loadingRim}
                  >
                    <option value="">
                      {sizeFilters.aspect
                        ? loadingRim
                          ? "กำลังโหลด..."
                          : "ขนาดล้อ (นิ้ว)"
                        : "เลือกแก้มยางก่อน"}
                    </option>
                    {rimOptions.map((rim) => (
                      <option key={rim} value={String(rim)}>
                        {rim}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

          </>
        ) : activeTab === TAB_BY_IMAGE ? (
          <div className="search-image-block">
            <div className="search-image-upload">
              {cameraOpen ? (
                <video ref={videoRef} className="search-image-preview" playsInline muted />
              ) : imagePreviewUrl ? (
                <img className="search-image-preview" src={imagePreviewUrl} alt="ตัวอย่างภาพค้นหา" />
              ) : (
                <div className="search-image-placeholder">อัปโหลดหรือถ่ายภาพหน้ายาง/รุ่นยาง</div>
              )}
            </div>
            <div className="search-image-actions">
              <label className="search-image-btn">
                เลือกรูปจากเครื่อง
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) => handleImageFileChange(event.target.files?.[0])}
                />
              </label>

              {cameraOpen ? (
                <>
                  <button className="search-image-btn" type="button" onClick={captureFromCamera}>
                    ถ่ายภาพ
                  </button>
                  <button className="search-image-btn ghost" type="button" onClick={stopCamera}>
                    ปิดกล้อง
                  </button>
                </>
              ) : (
                <button
                  className="search-image-btn"
                  type="button"
                  onClick={startCamera}
                  disabled={startingCamera}
                >
                  {startingCamera ? "กำลังเปิดกล้อง..." : "เปิดกล้องในหน้าเว็บ"}
                </button>
              )}
            </div>
            <canvas ref={canvasRef} className="search-image-canvas" />
            {imageSearchError && <div className="search-image-error">{imageSearchError}</div>}
          </div>
        ) : (

          <div className="search-row">
            {useInAppPicker ? (
              <>
                {renderPickerTrigger("brand")}
                {renderPickerTrigger("model")}
              </>
            ) : (
              <>
                <select
                  className="sel"
                  value={brandSelectValue}
                  onChange={(event) => handleBrandChange(event.target.value)}
                  disabled={loadingBrand}
                >
                  <option value="">{loadingBrand ? "กำลังโหลด..." : "ยี่ห้อรถ"}</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
                <select
                  className="sel"
                  value={modelSelectValue}
                  onChange={(event) => handleModelChange(event.target.value)}
                  disabled={!brandSelectValue || loadingModel}
                >
                  <option value="">
                    {brandSelectValue ? (loadingModel ? "กำลังโหลด..." : "รุ่นรถ") : "เลือกรถก่อน"}
                  </option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>


        )}
        <div className="search-actions">
          <button
            className="search-btn"
            type="button"
            onClick={activeTab === TAB_BY_IMAGE ? handleImageSearch : handleSearch}
            disabled={imageSearchLoading || isNavigating}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {activeTab === TAB_BY_IMAGE
              ? imageSearchLoading
                ? "กำลังค้นหาจากภาพ..."
                : "ค้นหาจากภาพนี้"
              : "ค้นหายางที่ใช้ได้กับรถของฉัน"}
          </button>
          <button className="search-clear" type="button" onClick={handleClear}>
            ล้างค่าการค้นหา
          </button>
        </div>
        {searchError && activeTab !== TAB_BY_IMAGE ? (
          <div className="search-image-error">{searchError}</div>
        ) : null}
      </div>
      {useInAppPicker && pickerField && pickerMeta[pickerField] ? (
        <div className="search-picker-modal" role="dialog" aria-modal="true" aria-label={pickerMeta[pickerField].title}>
          <div className="search-picker-backdrop" onClick={closePicker} />
          <div className="search-picker-sheet">
            <div className="search-picker-head">
              <strong>{pickerMeta[pickerField].title}</strong>
              <button type="button" onClick={closePicker} aria-label="ปิด">ปิด</button>
            </div>
            <div className="search-picker-options">
              {pickerMeta[pickerField].options.length > 0 ? (
                pickerMeta[pickerField].options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`search-picker-option ${
                      String(pickerMeta[pickerField].value) === option.value ? "active" : ""
                    }`}
                    onClick={() => {
                      pickerMeta[pickerField].onSelect(option.value);
                      closePicker();
                    }}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="search-picker-empty">{pickerMeta[pickerField].placeholder}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
