"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    LoaderIcon,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Trash2,
    Plus,
    CheckCircle2,
    Building2,
    Building,
    Users2,
    User,
    UserCircle,
    Mic as MicIcon,
    Target,
    Globe as GlobeIcon,
    Briefcase,
    PartyPopper,
    Coffee,
    ArrowRight,
    Info,
    Database as DatabaseIcon
} from "lucide-react"
import { useAuth } from "@/components/auth/AuthProvider"
import { getFirebaseDb } from "@/src/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore"
import { InterviewerProfile } from "@/src/types"
// スキルナレッジベースはサーバー側で自動取得されるため、インポート不要

interface CreateInterviewModalProps {
    isOpen: boolean
    onClose: () => void
    onComplete?: (id: string) => void
}

const STEPS = [
    "大カテゴリ",
    "詳細ジャンル",
    "基本設定",
    "取材方針",
    "取材先情報",
    "質問構成",
    "質問の生成中",
    "質問案の確認・編集"
]

const GENRE_CATEGORIES = [
    {
        id: "business",
        label: "ビジネス・ニュース系",
        icon: Briefcase,
        description: "公式発表、事例紹介、経営者取材など",
        subGenres: ["プレスリリース", "導入事例 (Case Study)", "経営者インタビュー", "ビジネスニュース", "新サービス紹介"]
    },
    {
        id: "lifestyle",
        label: "ホビー・ライフスタイル系",
        icon: Coffee,
        description: "料理、趣味、旅行、暮らしの知恵など",
        subGenres: ["料理レシピ", "ホビー・趣味", "旅行・お出かけ", "ライフスタイル", "専門スキル解説"]
    },
    {
        id: "event",
        label: "イベント・コミュニティ系",
        icon: PartyPopper,
        description: "飲み会、同窓会、忘年会、イベントレポなど",
        subGenres: ["飲み会・忘年会", "同窓会・オフ会", "イベント告知", "イベントレポート", "コミュニティ紹介"]
    }
]

export function CreateInterviewModal({ isOpen, onClose, onComplete }: CreateInterviewModalProps) {
    const router = useRouter()
    const { user, firebaseUser } = useAuth()
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [interviewId, setInterviewId] = useState<string | null>(null)

    // Form State
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [genre, setGenre] = useState("")
    const [customGenre, setCustomGenre] = useState("")
    const [title, setTitle] = useState("")
    const [purpose, setPurpose] = useState("")
    const [targetAudience, setTargetAudience] = useState("")
    const [mediaType, setMediaType] = useState("")
    const [objective, setObjective] = useState("")
    const [supplementaryInfo, setSupplementaryInfo] = useState("")
    const [interviewSource, setInterviewSource] = useState<'self' | 'other'>("other")
    const [intervieweeType, setIntervieweeType] = useState<'company' | 'individual'>('individual')
    const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([])
    const [openingMessage, setOpeningMessage] = useState("")
    const [openingTemplate, setOpeningTemplate] = useState<string>(`本日はお忙しい中ご対応いただきありがとうございます。
[アカウント名]の[インタビュアー名]と申します。
今回は[インタビュー名]ということで、
[ターゲット]のかたに向けて、
[目的]と考えておりまして、
[媒体]に掲載予定です。
それではさっそくインタビューに入らせていただきます。`)
    const [showOpeningTemplateEditor, setShowOpeningTemplateEditor] = useState(false)
    const [availableKBs, setAvailableKBs] = useState<any[]>([])
    const [selectedKBIds, setSelectedKBIds] = useState<string[]>([])

    // Basic Info (Step 8)
    const [intervieweeName, setIntervieweeName] = useState("")
    const [intervieweeCompany, setIntervieweeCompany] = useState("")
    const [intervieweeTitle, setIntervieweeTitle] = useState("")

    // Interviewer Selection
    const [interviewers, setInterviewers] = useState<InterviewerProfile[]>([])
    const [selectedInterviewerId, setSelectedInterviewerId] = useState("")
    const [loadingInterviewers, setLoadingInterviewers] = useState(false)
    const [customGenresList, setCustomGenresList] = useState<string[]>([])

    // Load User Custom Genres & Interviewers
    useEffect(() => {
        const loadInitialData = async () => {
            if (!user?.uid || !user?.companyId || !isOpen) return

            // Load Custom Genres
            try {
                const userDoc = await getDoc(doc(getFirebaseDb(), "users", user.uid))
                if (userDoc.exists()) {
                    setCustomGenresList(userDoc.data().customGenres || [])
                }
            } catch (error) {
                console.error("Error loading custom genres:", error)
            }

            // Load Interviewers
            setLoadingInterviewers(true)
            try {
                const q = query(
                    collection(getFirebaseDb(), "interviewers"),
                    where("companyId", "==", user.companyId),
                    where("isActive", "==", true),
                    orderBy("createdAt", "desc")
                )
                const snapshot = await getDocs(q)
                const interviewerItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                } as InterviewerProfile))
                setInterviewers(interviewerItems)
                if (interviewerItems.length > 0) setSelectedInterviewerId(interviewerItems[0].id)
            } catch (error) {
                console.error("Error loading interviewers:", error)
            } finally {
                setLoadingInterviewers(false)
            }

            // Load User KBs by UID
            try {
                const kbRef = collection(getFirebaseDb(), "knowledgeBases")
                const q = query(
                    kbRef,
                    where("type", "==", "user"),
                    where("uploadedBy", "==", user.uid),
                    orderBy("createdAt", "desc")
                )
                const snapshot = await getDocs(q)
                const kbs = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((kb: any) => !kb.deleted)
                setAvailableKBs(kbs)
            } catch (error) {
                console.error("Error loading KBs:", error)
            }
        }
        loadInitialData()
    }, [user, isOpen])

    // 自薦時の自動入力ロジック
    useEffect(() => {
        if (interviewSource === 'self' && user) {
            setIntervieweeName(user.displayName || "")
            // 会社情報などはUserDocから取得できる場合は設定
        }
    }, [interviewSource, user])

    const handleNext = async () => {
        if (currentStep === 5) { // 質問構成
            const currentGenre = genre === "custom" ? customGenre : genre
            if (!currentGenre || !purpose || !targetAudience || !mediaType || !title) {
                alert("すべての項目を入力してください")
                return
            }
            await generateQuestions()
        } else if (currentStep === 7) { // 質問案の確認・編集 (最終ステップ)
            handleFinalize()
        } else {
            setCurrentStep(prev => prev + 1)
        }
    }

    const handleBack = () => {
        setCurrentStep(prev => prev - 1)
    }

    const generateQuestions = async () => {
        setLoading(true)
        setCurrentStep(6) // 生成中ステップ
        try {
            // ユーザーナレッジベース（選択したもの）を送信
            const knowledgeBaseIds = selectedKBIds

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort("Timeout"), 90000) // 90秒に延長

            const idToken = firebaseUser ? await firebaseUser.getIdToken() : null
            const headers: any = { "Content-Type": "application/json" }
            if (idToken) headers.Authorization = `Bearer ${idToken}`

            const selectedInterviewer = interviewers.find(i => i.id === selectedInterviewerId)

            const response = await fetch("/api/interview/generate-questions", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    title: title,
                    category: genre === "custom" ? customGenre : genre,
                    targetAudience,
                    mediaType,
                    interviewPurpose: purpose,
                    objective: objective,
                    interviewSource: interviewSource,
                    supplementaryInfo: supplementaryInfo,
                    interviewerName: selectedInterviewer?.name || "",
                    interviewerPrompt: selectedInterviewer?.prompt || "",
                    knowledgeBaseIds,
                    numQuestions: 8,
                    openingTemplate: openingTemplate,
                }),
                signal: controller.signal
            })

            if (!response.ok) {
                const errJson = await response.json().catch(() => null)
                const errMsg = errJson?.error || '質問生成に失敗しました'
                throw new Error(errMsg)
            }
            clearTimeout(timeoutId)

            if (!response.ok) throw new Error("質問生成に失敗しました")
            const data = await response.json()

            const parsedQuestions = data.questions.split("\n")
                .map((q: string) => q.replace(/^\d+[\.\)、]\s*/, "").trim())
                .filter((q: string) => q.length > 0)

            setGeneratedQuestions(parsedQuestions)
            setOpeningMessage(data.openingMessage || "")
            setCurrentStep(7) // 質問案の確認・編集ステップ
        } catch (error: any) {
            console.error("❌ 質問生成エラー:", error)
            if (error.name === "AbortError") {
                alert("質問生成がタイムアウトしました。もう一度お試しください。")
            } else {
                alert("質問生成に失敗しました。設定を見直してやり直してください。")
            }
            setCurrentStep(6) // 入力最終ステップに戻る
        } finally {
            setLoading(false)
        }
    }

    const handleFinalize = async () => {
        setLoading(true)
        try {
            if (!user?.companyId || !user?.uid) return

            const selectedInterviewer = interviewers.find(i => i.id === selectedInterviewerId)
            const finalGenre = genre === "custom" ? customGenre : genre

            const interviewData = {
                companyId: user.companyId,
                uid: user.uid,
                interviewerId: selectedInterviewerId,
                interviewerName: selectedInterviewer?.name || "AIインタビュー",
                interviewerRole: selectedInterviewer?.role || "編集者",
                mode: "voice",
                title: title || `${finalGenre}インタビュー`,
                intervieweeName,
                intervieweeCompany,
                intervieweeTitle,
                intervieweeType,
                interviewSource,
                category: finalGenre,
                targetAudience,
                mediaType,
                interviewPurpose: purpose,
                objective,
                supplementaryInfo,
                knowledgeBaseIds: selectedKBIds,
                questions: generatedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
                openingMessage,
                openingTemplate,
                status: "active",
                messages: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }

            const docRef = await addDoc(collection(getFirebaseDb(), "interviews"), interviewData)
            setInterviewId(docRef.id)

            // Save custom genre if used
            if (genre === "custom" && customGenre.trim()) {
                const trimmedGenre = customGenre.trim()
                if (!customGenresList.includes(trimmedGenre)) {
                    const newGenresList = [...customGenresList, trimmedGenre]
                    await setDoc(doc(getFirebaseDb(), "users", user.uid), {
                        customGenres: newGenresList
                    }, { merge: true })
                    setCustomGenresList(newGenresList)
                }
            }

            onComplete?.(docRef.id)
            setCurrentStep(10) // 完了ステップ (10)
        } catch (error) {
            console.error("Error saving interview:", error)
            alert("保存に失敗しました。")
        } finally {
            setLoading(false)
        }
    }

    const startRehearsal = () => {
        if (interviewId) {
            router.push(`/interview/${interviewId}`)
            onClose()
        }
    }

    const renderStep = () => {
        switch (currentStep) {
            case 0: // Large Category
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2 mb-4">
                            <Label className="text-xl font-bold block">インタビューの種類は？</Label>
                            <p className="text-sm text-muted-foreground">目的に合った大カテゴリを選択してください</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {GENRE_CATEGORIES.map(cat => {
                                const Icon = cat.icon
                                return (
                                    <Button
                                        key={cat.id}
                                        variant={selectedCategory === cat.id ? "default" : "outline"}
                                        className={`h-24 justify-start p-6 text-left border-2 transition-all ${selectedCategory === cat.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"
                                            }`}
                                        onClick={() => {
                                            setSelectedCategory(cat.id)
                                            setGenre("")
                                        }}
                                    >
                                        <div className={`p-3 rounded-lg mr-4 ${selectedCategory === cat.id ? "bg-primary-foreground/20" : "bg-muted"}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-lg">{cat.label}</div>
                                            <div className="text-sm opacity-80">{cat.description}</div>
                                        </div>
                                        <ArrowRight className={`h-5 w-5 ml-auto opacity-50 ${selectedCategory === cat.id ? "opacity-100" : ""}`} />
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )
            case 1: // Sub-Genre Selection
                const category = GENRE_CATEGORIES.find(c => c.id === selectedCategory)
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2 mb-4">
                            <Label className="text-xl font-bold block">詳細ジャンルを選択</Label>
                            <p className="text-sm text-muted-foreground">「{category?.label}」の中から最適なものを選んでください</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {category?.subGenres.map(g => (
                                <Button
                                    key={g}
                                    variant={genre === g ? "default" : "outline"}
                                    className="justify-start h-auto py-3 px-4 text-left font-medium"
                                    onClick={() => setGenre(g)}
                                >
                                    {g}
                                </Button>
                            ))}
                            {customGenresList.map(g => (
                                <Button
                                    key={g}
                                    variant={genre === g ? "default" : "outline"}
                                    className="justify-start h-auto py-3 px-4 text-left font-medium border-dashed border-primary/30"
                                    onClick={() => setGenre(g)}
                                >
                                    {g} (保存済み)
                                </Button>
                            ))}
                            <Button
                                variant={genre === "custom" ? "default" : "outline"}
                                className="justify-start h-auto py-3 px-4 text-left font-medium"
                                onClick={() => setGenre("custom")}
                            >
                                その他（自由入力）
                            </Button>
                        </div>
                        {genre === "custom" && (
                            <div className="pt-4 border-t animate-in fade-in slide-in-from-top-2">
                                <Input
                                    placeholder="新しいジャンル名を入力してください"
                                    value={customGenre}
                                    onChange={e => setCustomGenre(e.target.value)}
                                    className="text-lg py-6"
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground mt-2">※保存すると次回からリストに表示されます</p>
                            </div>
                        )}
                    </div>
                )
            case 2: // Basic Settings
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2 mb-4">
                            <Label className="text-xl font-bold block">インタビューの基本設定</Label>
                            <p className="text-sm text-muted-foreground">タイトルの入力とインタビュアーの選択を行います</p>
                        </div>
                        <div className="space-y-6 bg-muted/20 p-6 rounded-xl border">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Building2 className="h-4 w-4 mr-2 text-primary" /> インタビュー名 *
                                    </div>
                                    <div className="flex bg-muted rounded-lg p-1 scale-90 origin-right">
                                        <button
                                            className={`px-3 py-1 text-xs rounded-md transition-all ${interviewSource === 'other' ? 'bg-white shadow-sm font-bold' : 'text-muted-foreground'}`}
                                            onClick={() => setInterviewSource('other')}
                                        >
                                            他薦（取材）
                                        </button>
                                        <button
                                            className={`px-3 py-1 text-xs rounded-md transition-all ${interviewSource === 'self' ? 'bg-white shadow-sm font-bold text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => setInterviewSource('self')}
                                        >
                                            自薦（本人）
                                        </button>
                                    </div>
                                </Label>
                                <Input
                                    placeholder="例：〇〇社 導入事例インタビュー"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="text-lg py-6 bg-background"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center">
                                    <MicIcon className="h-4 w-4 mr-2 text-primary" /> 担当インタビュアー *
                                </Label>
                                {loadingInterviewers ? (
                                    <div className="flex items-center gap-2 p-3 bg-background rounded-lg border border-dashed">
                                        <LoaderIcon className="h-4 w-4 animate-spin" />
                                        <span className="text-xs text-muted-foreground">読み込み中...</span>
                                    </div>
                                ) : (
                                    <select
                                        value={selectedInterviewerId}
                                        onChange={(e) => setSelectedInterviewerId(e.target.value)}
                                        className="w-full p-3 bg-background rounded-lg border border-input text-sm focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="none">選択してください</option>
                                        {interviewers.map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.role})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
                )
            case 3: // Strategy (Purpose, Target, Media)
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2 mb-4">
                            <Label className="text-xl font-bold block">執筆・取材の方針</Label>
                            <p className="text-sm text-muted-foreground">記事の目的やターゲットに合わせてAIが質問を最適化します</p>
                        </div>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center">
                                    <Target className="h-4 w-4 mr-2 text-primary" /> 取材の目的 *
                                </Label>
                                <Textarea
                                    placeholder="例：新サービスの開発背景と差別化要因を明確にしたい。"
                                    className="min-h-[80px] text-sm p-4 leading-relaxed"
                                    value={purpose}
                                    onChange={e => setPurpose(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold flex items-center">
                                        <Users2 className="h-4 w-4 mr-2 text-primary" /> ターゲット *
                                    </Label>
                                    <Input
                                        placeholder="例：30代のIT業界マネージャー"
                                        value={targetAudience}
                                        onChange={e => setTargetAudience(e.target.value)}
                                        className="text-sm bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold flex items-center">
                                        <GlobeIcon className="h-4 w-4 mr-2 text-primary" /> 掲載媒体 *
                                    </Label>
                                    <Input
                                        placeholder="例：自社ブログ / note"
                                        value={mediaType}
                                        onChange={e => setMediaType(e.target.value)}
                                        className="text-sm bg-background"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 4: // Interviewee Details
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2 mb-4">
                            <Label className="text-xl font-bold block">取材対象者の情報</Label>
                            <p className="text-sm text-muted-foreground">インタビュー相手の情報を入力してください</p>
                        </div>
                        <div className="space-y-5 bg-muted/20 p-6 rounded-xl border">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold flex items-center">
                                        <User className="h-4 w-4 mr-2 text-primary" /> お名前 *
                                    </Label>
                                    <Input
                                        placeholder="山田 太郎"
                                        value={intervieweeName}
                                        onChange={e => setIntervieweeName(e.target.value)}
                                        className="bg-background"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold flex items-center">
                                        <Building2 className="h-4 w-4 mr-2 text-primary" /> 会社名・団体名
                                    </Label>
                                    <Input
                                        placeholder="株式会社サンプル"
                                        value={intervieweeCompany}
                                        onChange={e => setIntervieweeCompany(e.target.value)}
                                        className="bg-background"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center">
                                    <Briefcase className="h-4 w-4 mr-2 text-primary" /> 役職・部署
                                </Label>
                                <Input
                                    placeholder="例：広報部 部長"
                                    value={intervieweeTitle}
                                    onChange={e => setIntervieweeTitle(e.target.value)}
                                    className="bg-background"
                                />
                            </div>
                        </div>
                    </div>
                )
            case 5: // Structure (Objective, Supplementary, KBs)
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2 mb-4">
                            <Label className="text-xl font-bold block">具体的な質問・構成</Label>
                            <p className="text-sm text-muted-foreground">AIが質問を構成する際の最も重要な指針になります</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center">
                                    <Sparkles className="h-4 w-4 mr-2 text-primary" /> 具体的に聞きたいこと・構成（任意）
                                </Label>
                                <Textarea
                                    placeholder="例：&#13;&#10;・サービス導入の決め手は何だったか？&#13;&#10;・導入後にどのような業務効率化が図れたか？"
                                    className="min-h-[100px] text-sm p-4 leading-relaxed"
                                    value={objective}
                                    onChange={e => setObjective(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground italic">※空欄の場合はAIにおまかせになります</p>
                            </div>

                            {/* Opening template preview & editor */}
                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-bold flex items-center">
                                        <Sparkles className="h-4 w-4 mr-2 text-primary" /> オープニングテンプレート（話す順）
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setShowOpeningTemplateEditor(prev => !prev)}>
                                            {showOpeningTemplateEditor ? '閉じる' : '編集'}
                                        </Button>
                                    </div>
                                </div>

                                {!showOpeningTemplateEditor ? (
                                    <div className="bg-background p-3 rounded-md text-sm whitespace-pre-wrap">
                                        {openingTemplate
                                            .replace(/\[アカウント名\]/g, user?.companyId ? (user?.companyId) : 'BanKisha')
                                            .replace(/\[インタビュアー名\]/g, interviewers.find(i=>i.id===selectedInterviewerId)?.name || '')
                                            .replace(/\[インタビュー名\]/g, title || '')
                                            .replace(/\[ターゲット\]/g, targetAudience || '')
                                            .replace(/\[目的\]/g, purpose || '')
                                            .replace(/\[媒体\]/g, mediaType || '')
                                        }
                                    </div>
                                ) : (
                                    <Textarea
                                        className="min-h-[140px] text-sm p-3 leading-relaxed"
                                        value={openingTemplate}
                                        onChange={(e) => setOpeningTemplate(e.target.value)}
                                    />
                                )}
                                <p className="text-[10px] text-muted-foreground italic">※[] 内はプレースホルダです。編集すると生成時に使用されます。</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center">
                                    <Info className="h-4 w-4 mr-2 text-primary" /> 補足情報 (日時・場所・URLなど)
                                </Label>
                                <Textarea
                                    placeholder="例：2025年1月10月 14:00〜 オンラインにて。"
                                    className="min-h-[60px] text-sm p-4 leading-relaxed"
                                    value={supplementaryInfo}
                                    onChange={e => setSupplementaryInfo(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <Label className="text-sm font-bold flex items-center">
                                    <DatabaseIcon className="h-4 w-4 mr-2 text-primary" /> 参照ナレッジベース
                                </Label>
                                <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                                    {availableKBs.length === 0 ? (
                                        <div className="text-center py-4 bg-muted/30 rounded-lg border border-dashed text-xs text-muted-foreground">
                                            登録済みのナレッジはありません
                                        </div>
                                    ) : (
                                        availableKBs.map(kb => (
                                            <div
                                                key={kb.id}
                                                className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${selectedKBIds.includes(kb.id)
                                                    ? 'bg-primary/5 border-primary'
                                                    : 'bg-background hover:bg-muted/30'
                                                    }`}
                                                onClick={() => {
                                                    setSelectedKBIds(prev =>
                                                        prev.includes(kb.id)
                                                            ? prev.filter(id => id !== kb.id)
                                                            : [...prev, kb.id]
                                                    )
                                                }}
                                            >
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold truncate">{kb.fileName}</span>
                                                    {kb.category && <span className="text-[9px] text-primary">{kb.category}</span>}
                                                </div>
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${selectedKBIds.includes(kb.id) ? 'bg-primary border-primary' : 'bg-background'}`}>
                                                    {selectedKBIds.includes(kb.id) && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 6: // AI Generation Loading
                return (
                    <div className="py-20 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-3">
                            <h3 className="text-2xl font-bold">独自の質問セットを設計中</h3>
                            <p className="text-muted-foreground max-w-sm">
                                「{genre === "custom" ? customGenre : genre}」の文脈を理解し、<br />
                                無駄を排した鋭い質問を生成しています...
                            </p>
                        </div>
                    </div>
                )
            case 7: // Edit Questions
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-4">
                            <div>
                                <Label className="text-xl font-bold">{genre === "custom" ? customGenre : genre}の質問案</Label>
                                <p className="text-xs text-muted-foreground mt-1">ドラッグして順序変更（予定）や直接編集が可能です</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800 border-green-200">生成完了</Badge>
                        </div>
                        <ScrollArea className="h-[430px] pr-4">
                            <div className="space-y-6">
                                <div className="bg-muted/30 p-4 rounded-lg space-y-2 border">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center">
                                        <Sparkles className="h-3 w-3 mr-1" /> オープニング挨拶
                                    </Label>
                                    <Textarea
                                        value={openingMessage}
                                        onChange={e => setOpeningMessage(e.target.value)}
                                        className="text-sm bg-transparent border-none focus-visible:ring-0 p-0 resize-none h-auto min-h-[60px]"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">本題の質問（{generatedQuestions.length}問）</Label>
                                    {generatedQuestions.map((q, idx) => (
                                        <div key={idx} className="flex gap-3 group bg-white dark:bg-gray-800 p-3 rounded-lg border shadow-sm hover:border-primary/50 transition-colors">
                                            <div className="flex flex-col items-center pt-1">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                                                    {idx + 1}
                                                </span>
                                            </div>
                                            <Textarea
                                                value={q}
                                                onChange={e => {
                                                    const newQs = [...generatedQuestions]
                                                    newQs[idx] = e.target.value
                                                    setGeneratedQuestions(newQs)
                                                }}
                                                className="flex-1 bg-transparent border-none focus-visible:ring-0 p-0 text-sm leading-relaxed resize-none h-auto min-h-[40px]"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive h-8 w-8"
                                                onClick={() => {
                                                    const newQs = [...generatedQuestions]
                                                    newQs.splice(idx, 1)
                                                    setGeneratedQuestions(newQs)
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        className="w-full border-dashed h-12 hover:bg-muted/50"
                                        onClick={() => setGeneratedQuestions([...generatedQuestions, ""])}
                                    >
                                        <Plus className="h-4 w-4 mr-2" /> 質問を追加
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                )
            case 10: // Finish Success
                return (
                    <div className="py-12 space-y-8 text-center max-w-md mx-auto">
                        <div className="flex justify-center">
                            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center relative">
                                <CheckCircle2 className="h-16 w-16 text-primary" />
                                <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-yellow-500 animate-bounce" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-3xl font-extrabold tracking-tight">作成完了！</h3>
                            <div className="p-4 bg-muted/30 rounded-lg text-left border">
                                <p className="text-sm font-bold text-primary mb-1">インタビュー名</p>
                                <p className="text-lg font-bold truncate">{title}</p>
                            </div>
                            <p className="text-muted-foreground pt-4">
                                保存が完了しました。URLを共有して本番を開始するか、まずはリハーサルでAIの反応を確認しましょう。
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 pt-4">
                            <Button onClick={startRehearsal} size="xl" className="w-full text-lg shadow-xl shadow-primary/20 bg-gradient-to-r from-primary to-primary/80">
                                リハーサルを開始する
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-primary">
                                一覧に戻る
                            </Button>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
            <DialogContent className="max-w-[95vw] sm:max-w-[800px] w-full overflow-hidden flex flex-col h-[90vh] max-h-[850px] p-0 border-none shadow-2xl">
                {/* Step Indicator Header */}
                <div className="bg-muted/30 border-b px-8 py-4 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                            {currentStep < 9 ? `STEP 0${currentStep + 1}` : "SUCCESS"}
                        </span>
                        <DialogTitle className="text-lg font-bold">{STEPS[currentStep] || "完了"}</DialogTitle>
                    </div>
                    <div className="flex gap-1.5 pt-2">
                        {STEPS.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-500 ${idx === currentStep
                                    ? "w-10 bg-primary shadow-sm shadow-primary/50"
                                    : idx < currentStep
                                        ? "w-2 bg-primary/40"
                                        : "w-2 bg-muted-foreground/20"
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex-1 px-10 py-8 overflow-hidden relative">
                    {renderStep()}
                </div>

                {/* Footer controls */}
                {currentStep < 9 && (
                    <DialogFooter className="px-10 py-8 border-t bg-muted/10 flex-row items-center justify-between sm:justify-between">
                        <div className="flex-1">
                            {currentStep > 0 && currentStep !== 6 && currentStep !== 9 && currentStep !== 10 && (
                                <Button
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={loading}
                                    className="px-6 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" /> 戻る
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {currentStep < 7 && currentStep !== 6 && (
                                <Button variant="ghost" onClick={onClose} className="px-6">キャンセル</Button>
                            )}
                            <Button
                                onClick={handleNext}
                                disabled={
                                    loading ||
                                    (currentStep === 0 && !selectedCategory) ||
                                    (currentStep === 1 && !genre) ||
                                    (currentStep === 2 && !title) ||
                                    (currentStep === 3 && (!purpose || !targetAudience || !mediaType)) ||
                                    (currentStep === 4 && (!intervieweeName || (intervieweeType === 'company' && !intervieweeCompany))) ||
                                    (currentStep === 7 && (generatedQuestions.length === 0)) ||
                                    (currentStep === 8 && (!selectedInterviewerId || selectedInterviewerId === "none"))
                                }
                                className={`min-w-[140px] px-8 text-base shadow-lg transition-all ${currentStep === 6 || currentStep === 7 ? "bg-primary" : ""
                                    }`}
                                size="lg"
                            >
                                {loading ? (
                                    <LoaderIcon className="h-5 w-5 animate-spin" />
                                ) : currentStep === 6 ? (
                                    <>生成中...</>
                                ) : currentStep === 7 ? (
                                    <>保存して作成 <CheckCircle2 className="ml-2 h-4 w-4" /></>
                                ) : currentStep === 5 ? (
                                    <>質問案を生成 <Sparkles className="ml-2 h-4 w-4" /></>
                                ) : (
                                    <>次へ <ChevronRight className="ml-2 h-4 w-4" /></>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
