import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const slides = [
    {
        image: '/images/community-1.jpg',
        title: 'Education for the Deaf',
        caption: 'Ghanaian students learning and communicating through sign language in school.',
        tag: 'Students'
    },
    {
        image: '/images/community-2.jpg',
        title: 'Every Child Deserves to be Heard',
        caption: 'Children across Ghana calling for inclusive education and communication support.',
        tag: 'Inclusion'
    },
    {
        image: '/images/community-3.jpg',
        title: 'Community Outreach',
        caption: 'Empowering communities in Ghana with accessible communication tools.',
        tag: 'Community'
    },
    {
        image: '/images/community-4.jpg',
        title: 'Teach Sign Language in Schools',
        caption: 'Advocating for sign language education to build a more inclusive Ghanaian society.',
        tag: 'Advocacy'
    }
]

export default function CommunitySlider() {
    const [current, setCurrent] = useState(0)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [touchStart, setTouchStart] = useState<number | null>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const goTo = useCallback((index: number) => {
        if (isTransitioning) return
        setIsTransitioning(true)
        setCurrent((index + slides.length) % slides.length)
        setTimeout(() => setIsTransitioning(false), 500)
    }, [isTransitioning])

    const next = useCallback(() => goTo(current + 1), [current, goTo])
    const prev = useCallback(() => goTo(current - 1), [current, goTo])

    // Auto-advance every 5s
    useEffect(() => {
        timerRef.current = setInterval(next, 5000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [next])

    // Pause on hover
    const pause = () => { if (timerRef.current) clearInterval(timerRef.current) }
    const resume = () => { timerRef.current = setInterval(next, 5000) }

    // Swipe support
    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX)
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return
        const diff = touchStart - e.changedTouches[0].clientX
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev()
        setTouchStart(null)
    }

    return (
        <section className="w-full mb-20">
            {/* Section heading */}
            <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    Who We <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">Serve</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
                    Real people across Ghana whose lives are transformed through accessible sign language technology.
                </p>
            </div>

            {/* Slider */}
            <div
                className="relative w-full max-w-4xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl"
                onMouseEnter={pause}
                onMouseLeave={resume}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Images */}
                <div className="relative h-[320px] sm:h-[420px] md:h-[500px] bg-slate-900">
                    {slides.map((slide, i) => (
                        <div
                            key={i}
                            className={`absolute inset-0 transition-opacity duration-500 ${i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                }`}
                        >
                            <img
                                src={slide.image}
                                alt={slide.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                            {/* Caption */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 z-20">
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-500/80 text-white mb-3 backdrop-blur-sm">
                                    {slide.tag}
                                </span>
                                <h3 className="text-white text-xl sm:text-2xl font-bold mb-1 leading-tight">
                                    {slide.title}
                                </h3>
                                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
                                    {slide.caption}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Prev / Next arrows */}
                <button
                    onClick={prev}
                    aria-label="Previous"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-all duration-200"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                    onClick={next}
                    aria-label="Next"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-all duration-200"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-4 right-6 z-30 flex gap-2 items-center">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Go to slide ${i + 1}`}
                            className={`rounded-full transition-all duration-300 ${i === current
                                    ? 'w-6 h-2 bg-white'
                                    : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
