import { afterNextRender, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type LanguageCode = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly localeSubject = new BehaviorSubject<LanguageCode>('en');
  readonly locale$ = this.localeSubject.asObservable();
  private currentLocale: LanguageCode = 'en';
  private readonly originalText = new WeakMap<Text, string>();
  private readonly originalAttributes = new WeakMap<Element, Map<string, string>>();
  private observer?: MutationObserver;

  private readonly translations: Record<string, string> = Object.assign(
    {},
    {
      'LEARNING WORKSPACE': 'مساحة التعلم',
      'INSTRUCTOR WORKSPACE': 'مساحة المدرّس',
      'STUDENT WORKSPACE': 'مساحة الطالب',
      'Teaching Operations': 'عمليات التدريس',
      'AI Teaching Studio': 'استوديو التدريس الذكي',
      'Teaching Copilot': 'مساعد التدريس الذكي',
      'Learning Hub': 'مركز التعلم',
      'AI Learning Studio': 'استوديو التعلم الذكي',
      'Academic Performance': 'الأداء الأكاديمي',
      'Instructor Hub': 'مركز المدرّس',
      'Curriculum Builder': 'منشئ المناهج',
      'Instructor Mode': 'وضع المدرّس',
      'Student Mode': 'وضع الطالب',
      'Admin Mode': 'وضع المسؤول',
      'Overview & Telemetry': 'نظرة عامة والقياسات',
      'Grading Queue': 'قائمة التصحيح',
      'Managed Courses': 'الدورات المدارة',
      'Student Cohort Roster': 'سجل الدفعة الطلابية',
      'AI Quiz Studio': 'استوديو اختبارات الذكاء الاصطناعي',
      'AI Code Reviewer': 'محلل ومراجع الكود الذكي',
      'AI Teaching Assistant': 'مساعد التدريس الذكي',
      'Enrolled Student Roster': 'سجل الطلاب المسجلين',
      'My Authored Courses': 'دوراتي التعليمية',
      'Explore courses': 'استكشف الدورات',
      'Track your learning progress and continue your courses.': 'تابع تقدمك التعليمي وواصل دوراتك.',
      'Track your learning progress': 'تابع تقدمك التعليمي',
      'continue your courses': 'واصل دوراتك',
      'Your progress': 'تقدمك',
      'Start course': 'ابدأ الدورة',
      Resume: 'تابع',
      Start: 'ابدأ',
      View: 'عرض',
      'Resume your current course': 'تابع دورتك الحالية',
      'The in-progress course card links directly to your next lesson and keeps your recent learning context close at hand.': 'ينقلك مربع الدورة الجارية مباشرةً إلى درسك التالي، ويُبقي سياق تعلمك الأخير قريبًا منك.',
      'Track the habits behind progress': 'تابع العادات التي تدعم تقدمك',
      'Streaks, study hours, completion, and assessment results provide different signals about your learning routine.': 'تعرض سلاسل التعلم وساعات الدراسة والإكمال ونتائج التقييم مؤشرات مختلفة عن عاداتك التعليمية.',
      'Plan around upcoming work': 'خطط للمهام القادمة',
      '+2 from last week': '+٢ مقارنة بالأسبوع الماضي',
      '+18% this month': '+١٨٪ هذا الشهر',
      'Top 12% of learners': 'ضمن أفضل ١٢٪ من المتعلمين',
      '+4% from last month': '+٤٪ مقارنة بالشهر الماضي',
      'execution contexts, promises, and event loop patterns.': 'سياقات التنفيذ والوعود وأنماط حلقة الأحداث.',
      Recommendation: 'توصية',
      'Async Scheduler & Event Loop Engine': 'مجدول المهام غير المتزامنة ومحرك حلقة الأحداث',
      'Design and test a task scheduler that handles asynchronous queues safely.': 'صمّم واختبر مجدول مهام يدير قوائم الانتظار غير المتزامنة بأمان.',
      '+18.4% this period': '+١٨٫٤٪ خلال هذه الفترة',
      '75% verified': 'تم التحقق من ٧٥٪',
      '+3.1% first-attempt accuracy': '+٣٫١٪ في دقة المحاولة الأولى',
      '+12.4% this month': '+١٢٫٤٪ هذا الشهر',
      '2 pending review': 'عنصران بانتظار المراجعة',
      '+3.2% vs last month': '+٣٫٢٪ مقارنة بالشهر الماضي',
      'Submitted capstone rubric · 1.2h ago': 'تم تسليم معيار تقييم المشروع الختامي · قبل ساعة و١٢ دقيقة',
      'Completed Quiz 3 · 96% score': 'أكمل الاختبار الثالث · النتيجة ٩٦٪',
      'Foundations & Variables': 'الأساسيات والمتغيرات',
      'Scopes & Closures': 'النطاقات والإغلاقات',
      'Async JavaScript & Event Loop': 'JavaScript غير المتزامنة وحلقة الأحداث',
      '+9.1% this quarter': '+٩٫١٪ خلال هذا الربع',
      '+14.2% YoY': '+١٤٫٢٪ على أساس سنوي',
      'Generates synthesized content from audit data and flags unverified outcomes.': 'ينشئ محتوى مركبًا من بيانات التدقيق ويحدد النتائج التي لم يتم التحقق منها.',
      'ML-101: Content Lab': 'تعلم الآلة ١٠١: مختبر المحتوى',
      'Personalized roadmaps that evolve with your goals and progress.': 'مسارات تعلم مخصصة تتطور وفق أهدافك وتقدمك.',
      'Get unstuck faster with an intelligent learning companion.': 'تجاوز العقبات بسرعة بمساعدة رفيق تعلم ذكي.',
      'Apply what you learn in production-style environments.': 'طبّق ما تتعلمه في بيئات تحاكي تطبيقات الإنتاج.',
      'Personalized learning paths and intelligent tutoring for ambitious builders.': 'مسارات تعلم مخصصة وإرشاد ذكي للمبدعين الطموحين.',
      '4 courses': '٤ دورات',
      '3 projects': '٣ مشاريع',
      'Question': 'السؤال',
      courses: 'دورات',
      course: 'دورة',
      Course: 'دورة',
      'Learning Streak': 'سلسلة التعلم',
      'Hours Learned': 'ساعات التعلم',
      'Courses Completed': 'الدورات المكتملة',
      'Average Score': 'متوسط الدرجات',
      '21 days': '٢١ يومًا',
      '6.5 hrs': '٦٫٥ ساعات',
      '7 hrs': '٧ ساعات',
      '4.5h': '٤٫٥ ساعات',
      '24.5h': '٢٤٫٥ ساعة',
      '54.2 hrs': '٥٤٫٢ ساعة',
      'days': 'أيام',
      ' hrs': ' ساعات',
      '12 days': '١٢ يومًا',
      'Completed': 'مكتملة',
      'In progress': 'قيد التقدم',
      'Saved': 'المحفوظة',
      'All (': 'الكل (',
      'In progress (': 'قيد التقدم (',
      'Completed (': 'المكتملة (',
      'Saved (': 'المحفوظة (',
      'complete': 'مكتمل',
      'Continue current module': 'تابع الوحدة الحالية',
      'Continue learning': 'تابع التعلم',
      'STEP 01 · FOUNDATION': 'الخطوة ٠١ · الأساسيات',
      'STEP 02 · CORE MASTERY': 'الخطوة ٠٢ · إتقان الأساسيات',
      'STEP 03 · CURRENT FOCUS': 'الخطوة ٠٣ · التركيز الحالي',
      'STEP 04 · UP NEXT': 'الخطوة ٠٤ · التالي',
      'Complete': 'مكتمل',
      'Up next': 'التالي',
      'Foundations & setup': 'الأساسيات والإعداد',
      'Scopes & execution': 'النطاقات والتنفيذ',
      'Async JavaScript': 'JavaScript غير المتزامن',
      'Angular signals & effects': 'إشارات Angular وتأثيراتها',
      'Module 6 · Core': 'الوحدة ٦ · الأساسيات',
      'Learn through focused, hands-on lessons.': 'تعلّم عبر دروس عملية ومركزة.',
      '· Context aware': '· يدرك سياق التعلم',
      'Start a targeted exercise': 'ابدأ تمرينًا مخصصًا',
      'Single choice': 'اختيار واحد',
      'Practice preview': 'معاينة التدريب',
      'PRACTICE COMPLETE': 'اكتمل التدريب',
      'You scored': 'نتيجتك',
      'Your answers stay in this preview and are not sent to a server.': 'تبقى إجاباتك في هذه المعاينة ولا تُرسل إلى أي خادم.',
      'Try again': 'أعد المحاولة',
      'Practice progress': 'تقدم التدريب',
      'Your answers are kept in this local preview.': 'تُحفظ إجاباتك في هذه المعاينة المحلية.',
      'correct so far': 'إجابات صحيحة حتى الآن',
      'REVIEW TOPIC': 'موضوع للمراجعة',
      'Computed signal dependencies and cached values.': 'اعتماديات الإشارات المحسوبة والقيم المخزنة مؤقتًا.',
      'When does a computed signal recalculate its value?': 'متى تعيد الإشارة المحسوبة حساب قيمتها؟',
      'Whenever the component renders': 'عند كل مرة يُعرض فيها المكوّن',
      'Computed values are not tied to component lifecycle.': 'لا ترتبط القيم المحسوبة بدورة حياة المكوّن.',
      'When a signal it read changes': 'عند تغيّر إحدى الإشارات التي قرأتها',
      'Dependencies are tracked automatically while evaluating the computation.': 'تُتتبّع الاعتماديات تلقائيًا أثناء تقييم العملية الحسابية.',
      'Only when explicitly refreshed': 'فقط عند تحديثها يدويًا',
      'Computed signals update reactively; they do not need a manual refresh.': 'تتحدّث الإشارات المحسوبة تفاعليًا ولا تحتاج إلى تحديث يدوي.',
      'At fixed time intervals': 'على فترات زمنية ثابتة',
      'Signals are synchronous state primitives, not polling timers.': 'الإشارات عناصر حالة متزامنة وليست مؤقتات للاستقصاء.',
      'What does Angular track while evaluating a computed signal?': 'ما الذي يتتبعه Angular أثناء تقييم إشارة محسوبة؟',
      'Every signal read during evaluation': 'كل إشارة تُقرأ أثناء التقييم',
      'Those reads become the computed value’s reactive dependencies.': 'تصبح الإشارات المقروءة اعتماديات تفاعلية للقيمة المحسوبة.',
      'Only signals declared in the same file': 'الإشارات المعرّفة في الملف نفسه فقط',
      'Dependencies are determined by reads, not file location.': 'تُحدّد الاعتماديات بحسب الإشارات المقروءة، لا موقع الملف.',
      'No dependencies until a timer runs': 'لا توجد اعتماديات حتى يعمل مؤقت',
      'Computed signals update synchronously when dependencies change.': 'تتحدّث الإشارات المحسوبة تزامنيًا عند تغيّر اعتمادياتها.',
      'Every component input automatically': 'كل مدخلات المكوّن تلقائيًا',
      'Only signals actually read by the computation are tracked.': 'لا يُتتبّع إلا ما تقرؤه العملية الحسابية فعليًا من إشارات.',
      'Why does Angular cache a computed signal value?': 'لماذا يخزّن Angular قيمة الإشارة المحسوبة مؤقتًا؟',
      'To avoid recalculating until a dependency changes': 'لتجنب إعادة الحساب حتى تتغيّر إحدى الاعتماديات',
      'The cached result remains valid while its dependencies remain unchanged.': 'تظل النتيجة المخزنة صالحة ما دامت اعتمادياتها دون تغيير.',
      'To prevent future updates': 'لمنع التحديثات المستقبلية',
      'A dependency change invalidates the cached value.': 'يؤدي تغيّر إحدى الاعتماديات إلى إبطال القيمة المخزنة.',
      'To save the value between browser sessions': 'لحفظ القيمة بين جلسات المتصفح',
      'Computed values are in-memory reactive state.': 'القيم المحسوبة حالة تفاعلية محفوظة في الذاكرة.',
      'To force periodic refreshes': 'لفرض تحديثات دورية',
      'Need conceptual guidance?': 'هل تحتاج إلى إرشاد لفهم المفهوم؟',
      'Ask the AI Tutor for a hint without revealing the answer.': 'اطلب تلميحًا من المعلم الذكي دون كشف الإجابة.',
      'Previous': 'السابق',
      'Save & next': 'احفظ وانتقل',
      'Finish quiz': 'أنه الاختبار',
      'Cognitive diagnostics': 'تحليلات الفهم',
      '17 / 20 correct': '١٧ / ٢٠ إجابة صحيحة',
      'KNOWLEDGE GAP': 'فجوة معرفية',
      'Review dependency tracking and signal equality checks.': 'راجع تتبع الاعتماديات والتحقق من تساوي الإشارات.',
      'Choose an answer to continue.': 'اختر إجابة للمتابعة.',
      'Answer saved in this preview. The next question is ready.': 'حُفظت الإجابة في هذه المعاينة. السؤال التالي جاهز.',
      'Returned to the previous question.': 'عدت إلى السؤال السابق.',
      'Practice complete. Review your score below.': 'اكتمل التدريب. راجع نتيجتك أدناه.',
      'Question {{ quizQuestion }} of {{ quizQuestions.length }} · Single choice': 'السؤال {{ quizQuestion }} من {{ quizQuestions.length }} · اختيار واحد',
      'Neural AST Engine v4.2': 'محرك تحليل الشفرة العصبي v4.2',
      'Load from course': 'حمّل من الدورة',
      'TS Strict Mode': 'وضع TypeScript الصارم',
      'PRIMARY ISSUE · HIGH SEVERITY': 'المشكلة الأساسية · خطورة عالية',
      'ANALYSIS COMPLETE': 'اكتمل التحليل',
      '1 issue detected': 'تم اكتشاف مشكلة واحدة',
      '1 concept explained': 'تم شرح مفهوم واحد',
      'Recommendations': 'توصيات',
      'Learning note': 'ملاحظة تعليمية',
      'The response body is not awaited': 'لم تتم انتظار استجابة الطلب',
      'Calling': 'استدعاء',
      'returns a promise. Await it before storing or returning the parsed user data.': 'يعيد وعدًا برمجيًا. انتظر اكتماله قبل حفظ بيانات المستخدم المحللة أو إرجاعها.',
      'Computed values derive from tracked signals': 'تُشتق القيم المحسوبة من الإشارات المتتبعة',
      'Angular recomputes this value when a signal read inside the computation changes. The example depends on': 'يعيد Angular حساب هذه القيمة عند تغيّر إشارة تقرؤها العملية الحسابية. يعتمد المثال على',
      'and logs the derived value through an effect.': 'ويعرض القيمة المشتقة من خلال تأثير تفاعلي.',
      'SAMPLE REVIEW': 'مراجعة المثال',
      'SAMPLE REVIEW READY': 'مراجعة المثال جاهزة',
      'Ask AI Tutor': 'اسأل المعلم الذكي',
      'Upcoming': 'القادمة',
      'Submitted & graded': 'المسلّمة والمقيّمة',
      'Drafts': 'المسودات',
      'Due tomorrow': 'موعد التسليم غدًا',
      'Due in 4 days': 'موعد التسليم خلال ٤ أيام',
      'Difficulty: ': 'المستوى: ',
      'Reward: ': 'المكافأة: ',
      'Open assignment': 'افتح المهمة',
      'Recently graded': 'تم تقييمها مؤخرًا',
      'RECENTLY GRADED': 'تم تقييمها مؤخرًا',
      'Assignment 3: Async scheduler': 'المهمة ٣: مجدول المهام غير المتزامنة',
      'View evaluation breakdown': 'عرض تفاصيل التقييم',
      'STUDY INVESTMENT': 'الوقت المستثمَر في التعلم',
      'SKILL VALIDATION': 'التحقق من المهارات',
      'DIAGNOSTIC QUALITY': 'جودة التقييم',
      'LEARNING STREAK': 'سلسلة التعلم',
      'Personal best': 'أفضل إنجاز شخصي',
      'Aggregated study minutes across the past': 'إجمالي دقائق الدراسة خلال',
      'Last 7 days': 'آخر ٧ أيام',
      'Last 30 days': 'آخر ٣٠ يومًا',
      'Mastered skills mapped to your curriculum': 'المهارات المتقنة المرتبطة بمنهجك',
      'Enrolled courses velocity breakdown': 'تفاصيل التقدم في الدورات المسجل بها',
      'Syntax & patterns': 'الصياغة والأنماط',
      'Asynchronous JavaScript': 'JavaScript غير المتزامنة',
      'Angular signals': 'إشارات Angular',
      'Testing workflows': 'سير عمل الاختبارات',
      'Submit work and track feedback.': 'سلّم أعمالك وتابع الملاحظات.',
      'Submitted assignment': 'تم تسليم المهمة',
      'Due in 3 days': 'موعد التسليم خلال ٣ أيام',
      'Difficulty': 'المستوى',
      'Reward': 'المكافأة',
      'Reset filters': 'إعادة ضبط عوامل التصفية',
      'No saved courses yet': 'لا توجد دورات محفوظة بعد',
      'No completed courses yet': 'لا توجد دورات مكتملة بعد',
      'Save courses with the bookmark button, or adjust your search and filters.': 'احفظ الدورات باستخدام زر الإشارة المرجعية، أو غيّر البحث وعوامل التصفية.',
      'Remove ': 'إزالة ',
      ' from saved courses': ' من الدورات المحفوظة',
      'Save ': 'حفظ ',
      'Course ': 'الدورة ',
      'LESSONS': 'الدروس',
      'STEP 01': 'الخطوة ٠١',
      'STEP 02': 'الخطوة ٠٢',
      'STEP 03': 'الخطوة ٠٣',
      'STEP 04': 'الخطوة ٠٤',
      'FOUNDATION': 'الأساسيات',
      'CORE MASTERY': 'إتقان الأساسيات',
      'CURRENT FOCUS': 'التركيز الحالي',
      'UP NEXT': 'التالي',
      'Jan': 'يناير',
      'Feb': 'فبراير',
      'Mar': 'مارس',
      'Apr': 'أبريل',
      'May': 'مايو',
      'Jun': 'يونيو',
      'Jul': 'يوليو',
      'Dec': 'ديسمبر',
      'Dec 15': '١٥ ديسمبر',
      'week': 'أسبوع',
      'tomorrow': 'غدًا',
      'in 4 days': 'خلال ٤ أيام',
      'Live student activity': 'نشاط الطلاب المباشر',
      'Module 6 · Reactive primitives': 'الوحدة ٦ · العناصر التفاعلية',
      'Next lesson: Working with Angular Signals': 'الدرس التالي: العمل مع إشارات Angular',
      'Signals & RxJS quiz': 'اختبار الإشارات وRxJS',
      'Reactive state project': 'مشروع الحالة التفاعلية',
      'Current lesson · Signals & effects': 'الدرس الحالي · الإشارات والتأثيرات',
      'Daily focus goal: 45 minutes': 'هدف التركيز اليومي: ٤٥ دقيقة',
      'Send': 'إرسال',
      'New dialogue': 'محادثة جديدة',
      'Adaptive tutor': 'المعلم التكيفي',
      'Synced with Angular Signals': 'متزامن مع إشارات Angular',
      'I’m confused about computed signals and when they update. Could you explain?': 'أشعر بالارتباك بشأن الإشارات المحسوبة وموعد تحديثها. هل يمكنك التوضيح؟',
      'Computed signals: derived, cached state': 'الإشارات المحسوبة: حالة مشتقة ومخزنة مؤقتًا',
      ' signal recalculates when one of the signals it reads changes. Angular caches the value until a dependency changes, so it avoids unnecessary work.': ' تُعيد الحساب عند تغيّر إحدى الإشارات التي تقرؤها. يخزّن Angular القيمة مؤقتًا إلى أن تتغير إحدى الاعتماديات، لتجنب العمل غير الضروري.',
      'Think of it as a spreadsheet cell': 'تخيلها كخلية في جدول بيانات',
      'Change a referenced cell and the formula updates. If nothing it depends on changes, the previous result is reused.': 'غيّر خلية مرجعية لتتحدث المعادلة. وإذا لم يتغير ما تعتمد عليه، فستُستخدم النتيجة السابقة مجددًا.',
      'Ask a question about your current course or paste a code snippet below.': 'اطرح سؤالًا عن دورتك الحالية أو ألصق مقطع شفرة أدناه.',
      'New tutor dialogue started.': 'بدأت محادثة جديدة مع المعلم.',
      'Enter a question before sending it to the tutor.': 'أدخل سؤالًا قبل إرساله إلى المعلم.',
      'Message added to this tutor preview. AI responses require a connected backend.': 'أُضيفت الرسالة إلى معاينة المعلم. تتطلب استجابات الذكاء الاصطناعي ربط الواجهة الخلفية.',
    },
    {
      Home: 'الرئيسية',
    Courses: 'الدورات',
    'Learning Paths': 'مسارات التعلم',
    'AI Tutor': 'المعلم الذكي',
    About: 'من نحن',
    'Sign In': 'تسجيل الدخول',
    'Get started': 'ابدأ الآن',
    'Main navigation': 'القائمة الرئيسية',
    'Sign Up': 'تسجيل حساب',
    'Student Account': 'حساب الطالب',
    Dashboard: 'لوحة التحكم',
    'My Courses': 'دوراتي',
    'Explore Courses': 'استكشاف الدورات',
    'Learning Path': 'مسار التعلم',
    Quizzes: 'الاختبارات',
    Assignments: 'المهام',
    'Progress Analytics': 'تحليلات التقدم',
    'Instructor Dashboard': 'لوحة تحكم المدرس',
    'Admin Console': 'لوحة تحكم الإدارة',
    'Student account': 'حساب الطالب',
    'My courses': 'دوراتي',
    'Learning paths': 'مسارات التعلم',
    'Sign in': 'تسجيل الدخول',
    'Create your account': 'أنشئ حسابك',
    'Learn Smarter.': 'تعلم بشكل أذكى.',
    'Learn Faster.': 'تعلم بشكل أسرع.',
    'Learn With AI.': 'تعلّم بالذكاء الاصطناعي.',
    'Intelligent Learning Ecosystem': 'بيئة تعليم ذكية',
    'A COMPLETE LEARNING ECOSYSTEM': 'بيئة تعليمية كاملة',
    'Everything you need to': 'كل ما تحتاجه لــ',
    'level up': 'التطور',
    'Adaptive Learning Paths': 'مسارات تعلم تكيفية',
    'AI-Powered Tutoring': 'دروس مدعومة بالذكاء الاصطناعي',
    'Build Real Projects': 'بناء مشاريع حقيقية',
    'Curated for your growth': 'مُنتقاة لنموك',
    'Explore courses that': 'استكشف الدورات التي',
    'move you forward.': 'تدفعك للأمام.',
    'Learn from industry experts and build skills that compound over time.': 'تعلّم من خبراء الصناعة وبنِ مهارات تتراكم بمرور الوقت.',
    'Search courses, topics, or skills...': 'ابحث عن الدورات أو المواضيع أو المهارات...',
    'Show all courses': 'عرض كل الدورات',
    'Back to courses': 'العودة إلى الدورات',
    "What you'll learn": 'ما الذي ستتعلمه',
    'Hands-on projects': 'مشاريع عملية',
    'A practical system for making steady progress': 'نظام عملي لتحقيق تقدم مستمر',
    'How NexaLearn works': 'كيف يعمل NexaLearn',
    'Choose a clear goal': 'اختر هدفًا واضحًا',
    'Learn by doing': 'تعلّم بالنشاط',
    'Adjust as you grow': 'عدّل كلما تقدّمت',
    'Your learning hub is now active': 'مركز تعلمك أصبح نشطًا',
    'Manage your learning dashboard, courses, and progress in one place.': 'إدارة لوحة التحكم والدورات والتقدم في مكان واحد.',
    'Course library': 'مكتبة الدورات',
    'Roadmap': 'خارطة الطريق',
    'Analytics': 'التحليلات',
    'Quick access': 'الوصول السريع',
    'Live access': 'وصول مباشر',
    'System overview': 'نظرة عامة على النظام',
    'Admin Management & Platform Governance': 'إدارة المشرفين وحوكمة المنصة',
    'User directory': 'دليل المستخدمين',
    'Full name': 'الاسم الكامل',
    'Your name': 'اسمك',
    'Account type': 'نوع الحساب',
    Teacher: 'مدرس',
    'Please wait…': 'يرجى الانتظار…',
    'Guest account': 'حساب زائر',
    'Signed out': 'تم تسجيل الخروج',
    'Sign out': 'تسجيل الخروج',
    'Sign Out': 'تسجيل الخروج',
    'Sign in required': 'يلزم تسجيل الدخول',
    'Sign out could not be completed. Please try again.': 'تعذر تسجيل الخروج. يُرجى المحاولة مرة أخرى.',
    'SIGNING OUT': 'جارٍ تسجيل الخروج',
    'Your NexaLearn session is being securely ended.': 'يجري إنهاء جلستك في NexaLearn بطريقة آمنة.',
    'Student and teacher accounts can register here. Admin accounts are provisioned securely by an administrator.': 'يمكن للطلاب والمعلمين التسجيل هنا. ينشئ المسؤول حسابات الإدارة بطريقة آمنة.',
    'Cannot reach the account service. Start the backend and check its environment configuration.': 'تعذر الاتصال بخدمة الحسابات. شغّل الواجهة الخلفية وتحقق من إعدادات البيئة.',
    'The account request could not be completed. Please try again.': 'تعذر إكمال طلب الحساب. يُرجى المحاولة مرة أخرى.',
    'Account authentication is not configured. Set AUTH_JWT_SECRET to a random value of at least 32 bytes.': 'مصادقة الحسابات غير مهيأة. عيّن AUTH_JWT_SECRET إلى قيمة عشوائية لا تقل عن ٣٢ بايتًا.',
    'Sign in to continue.': 'سجّل الدخول للمتابعة.',
    'Email or password is incorrect.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'Choose either a student or teacher account. Admin accounts must be provisioned by an administrator.': 'اختر حساب طالب أو مدرس. يجب أن ينشئ مسؤول المنصة حسابات المشرفين.',
    'Name must be between 2 and 80 characters.': 'يجب أن يتراوح الاسم بين حرفين و٨٠ حرفًا.',
    'Password must be between 12 and 128 characters.': 'يجب أن تتراوح كلمة المرور بين ١٢ و١٢٨ حرفًا.',
    'Enter a valid email address.': 'أدخل عنوان بريد إلكتروني صالحًا.',
    'An account with this email address already exists.': 'يوجد حساب مسجل بعنوان البريد الإلكتروني هذا.',
    Role: 'الدور',
    Status: 'الحالة',
    Joined: 'تاريخ الانضمام',
    'Activate account': 'تفعيل الحساب',
    'Suspend access': 'تعليق الوصول',
    'Pending activation': 'في انتظار التفعيل',
    Active: 'نشط',
    Suspended: 'معلق',
    Student: 'طالب',
    Instructor: 'مدرس',
    Admin: 'مشرف',
    All: 'الكل',
    'WELCOME BACK, ALEX': 'مرحبًا بعودتك، Alex',
    'Continue learning': 'متابعة التعلم',
    'Upgrade your skills': 'طور مهاراتك',
    'Explore the catalog': 'استكشاف الكتالوج',
    'COURSE CATALOG GUIDE': 'دليل كتالوج الدورات',
    'Find the right course for your next milestone': 'اعثر على الدورة المناسبة لخطوتك التالية',
    'Your momentum is up 24% this week. Keep learning to reach your next milestone.': 'زخمك زاد بنسبة 24% هذا الأسبوع. واصل التعلم للوصول إلى مهمتك التالية.',
    'Adaptive learning journey active': 'رحلة تعليمية تكيفية نشطة',
    'Search enrolled courses': 'ابحث في الدورات المسجلة',
    'No courses found': 'لم يتم العثور على دورات',
    'Try another search, or explore the course catalog.': 'جرّب بحثًا مختلفًا أو استكشف كتالوج الدورات.',
    'Your dashboard brings course activity, progress, and upcoming work together so you can keep moving confidently.': 'تجمع لوحة التحكم النشاط الدراسي والتقدم والمهام القادمة في مكان واحد لتبقى متقدمًا بثقة.',
    'Student pages': 'صفحات الطالب',
    'Open dashboard': 'فتح لوحة التحكم',
    'View courses': 'عرض الدورات',
    'Open roadmap': 'فتح خريطة الطريق',
    'Review progress': 'مراجعة التقدم',
    'Toggle language': 'تبديل اللغة',
    'Switch language': 'تبديل اللغة',
    'Page language': 'لغة الصفحة',
    'Select English or Arabic': 'اختر الإنجليزية أو العربية',
    'Translate to and from Arabic and English': 'الترجمة من العربية إلى الإنجليزية ومن الإنجليزية إلى العربية',
    English: 'الإنجليزية',
    Arabic: 'العربية',
    },
    {
    Main: 'الرئيسية',
    Workspace: 'مساحة العمل',
    Teaching: 'التدريس',
    'Curriculum Builder': 'منشئ المناهج',
    'Student account active': 'حساب الطالب نشط',
    'Welcome back, Alex': 'مرحبًا بعودتك، Alex',
    'Your student portal is enabled. Jump into your learning workspace, course library, and progress pages to keep moving.': 'بوابة الطالب مفعّلة. انتقل إلى مساحة التعلم ومكتبة الدورات وصفحات التقدم لمواصلة رحلتك.',
    'Day streak': 'أيام متتالية',
    Curriculum: 'المنهج',
    'Weekly goal': 'الهدف الأسبوعي',
    'Current momentum': 'زخمك الحالي',
    'Resume your active course and review the latest milestones.': 'تابع دورتك الحالية وراجع أحدث الإنجازات.',
    'Browse enrolled courses, statuses, and continue where you left off.': 'تصفح الدورات المسجل بها وحالاتها، وتابع من حيث توقفت.',
    'Track milestones and plan the next steps in your career path.': 'تابع الإنجازات وخطط للخطوات التالية في مسارك المهني.',
    'Review study time, skill validation, and performance trends.': 'راجع وقت الدراسة والتحقق من المهارات واتجاهات الأداء.',
    'View activity, deadlines, and course momentum.': 'اعرض النشاط والمواعيد النهائية وتقدم الدورات.',
    'Continue enrolled learning journeys.': 'تابع رحلاتك التعليمية المسجل بها.',
    'Track submissions and deadlines.': 'تابع التسليمات والمواعيد النهائية.',
    'Understand performance over time.': 'افهم أداءك بمرور الوقت.',
    'Ask for explanations and learning guidance.': 'اطلب الشروحات والإرشاد التعليمي.',
    'Generate practice checks and confidence reviews.': 'أنشئ اختبارات تدريبية ومراجعات لقياس الثقة.',
    "Keep the momentum going. You're doing great.": 'واصل التقدم. أداؤك رائع.',
    'Pick up where you left off': 'تابع من حيث توقفت',
    'View all': 'عرض الكل',
    'All courses': 'جميع الدورات',
    'YOUR DAY': 'يومك',
    'Learning activity': 'النشاط التعليمي',
    'Upcoming deadlines': 'المواعيد النهائية القادمة',
    'IN PROGRESS': 'قيد التقدم',
    'UP NEXT': 'التالي',
    'CONTINUE LEARNING': 'واصل التعلم',
    'Development': 'التطوير',
    'Data Science': 'علم البيانات',
    'Artificial Intelligence': 'الذكاء الاصطناعي',
    Beginner: 'مبتدئ',
    Intermediate: 'متوسط',
    Advanced: 'متقدم',
    'reviews': 'تقييمات',
    lessons: 'دروس',
    learners: 'متعلمون',
    'Taught by': 'يقدمها',
    'Preview the curriculum': 'معاينة المنهج',
    'Course curriculum': 'منهج الدورة',
    'Course content': 'محتوى الدورة',
    'Enroll now': 'سجل الآن',
    'Start learning': 'ابدأ التعلم',
    'What makes this course useful?': 'ما فائدة هذه الدورة؟',
    'Our mission': 'مهمتنا',
    'Learn practical skills with support that meets you where you are.': 'تعلم مهارات عملية بدعم يناسب مستواك.',
    'Build skills for what comes next. Learn with expert-led courses and an AI companion that adapts to you.': 'اكتسب مهاراتك للخطوة القادمة. تعلم عبر دورات يقدمها خبراء ومساعد ذكي يتكيف معك.',
    Explore: 'استكشف',
    'About NexaLearn': 'عن NexaLearn',
    'Your learning': 'تعلمك',
    'Your next breakthrough starts here.': 'إنجازك القادم يبدأ هنا.',
    'Find your next course': 'اعثر على دورتك القادمة',
    'Made for curious minds': 'صُمم للعقول الفضولية',
    'Learn something remarkable.': 'تعلم شيئًا استثنائيًا.',
    'See how it works': 'اكتشف كيف يعمل',
    'learners building': 'متعلمون يبنون',
    'their future': 'مستقبلهم',
    'average learner': 'متوسط تقييم',
    rating: 'المتعلم',
    'Neural Code Co-Pilot': 'مساعد البرمجة العصبي',
    'Diagnostics: 99.8% precision': 'التشخيص: دقة 99.8%',
    'Realtime AST Review': 'مراجعة AST فورية',
    'Build production-grade engineering and data skills through personalized adaptive curricula, real-time code synthesis, and intelligent tutoring agents.': 'طوّر مهارات هندسية ومهارات بيانات بمستوى الإنتاج عبر مناهج تكيفية مخصصة وتوليد فوري للشفرة ومساعدين أذكياء للتعلم.',
    'No courses match your search': 'لا توجد دورات تطابق بحثك',
    'Try another title, skill, or category.': 'جرّب عنوانًا أو مهارة أو فئة مختلفة.',
    'Good morning, Alex': 'صباح الخير، Alex',
    'Modern Array Methods': 'أساليب المصفوفات الحديثة',
    'Module 3 quiz': 'اختبار الوحدة الثالثة',
    'Due today': 'موعد التسليم اليوم',
    '10 questions': '10 أسئلة',
    'Course not found': 'الدورة غير موجودة',
    'Course learning plan': 'خطة تعلم الدورة',
    'Preview the outcome': 'عاين النتائج',
    'What you will learn': 'ما الذي ستتعلمه',
    'Career target': 'الهدف المهني',
    'Target career role': 'الدور المهني المستهدف',
    'Weekly commitment': 'الالتزام الأسبوعي',
    'Update my path': 'حدّث مساري',
    'MAKE IT YOURS': 'خصصها لك',
    MOMENTUM: 'الزخم',
    'Skills unlocked': 'المهارات المكتسبة',
    'View skill progress': 'عرض تقدم المهارات',
    'Small sessions add up.': 'الجلسات القصيرة تصنع فرقًا.',
    'Your current pace keeps you on track for your target date.': 'وتيرتك الحالية تساعدك على الالتزام بموعدك المستهدف.',
    'Resume this milestone': 'تابع هذا الإنجاز',
    '4 of 6 milestones complete': 'اكتملت 4 من 6 إنجازات',
    'Overall progress': 'التقدم الإجمالي',
    'Target finish': 'موعد الإنجاز المستهدف',
    'Per week': 'أسبوعيًا',
    'Lesson video': 'فيديو الدرس',
    'Understanding reactive primitives': 'فهم العناصر التفاعلية الأساسية',
    'Start with the concept': 'ابدأ بالمفهوم',
    'Build on the foundation': 'ابنِ على الأساس',
    'Use signals to hold values that update reactively.': 'استخدم الإشارات للاحتفاظ بقيم تتحدث تفاعليًا.',
    'Use computed state for values derived from your signals.': 'استخدم الحالة المحسوبة للقيم المشتقة من إشاراتك.',
    'Lesson complete': 'اكتمل الدرس',
    'Mark complete & continue': 'أكمل وتابع',
    'Course syllabus': 'منهج الدورة',
    'Adaptive tutor': 'المعلم التكيفي',
    'Synced with Angular Signals': 'متزامن مع إشارات Angular',
    'New dialogue': 'محادثة جديدة',
    'I’m confused about computed signals and when they update. Could you explain?': 'أشعر بالارتباك حول الإشارات المحسوبة ووقت تحديثها. هل يمكنك التوضيح؟',
    'Computed signals: derived, cached state': 'الإشارات المحسوبة: حالة مشتقة ومخزنة مؤقتًا',
    'Think of it as a spreadsheet cell': 'تخيلها كخلية في جدول بيانات',
    'Change a referenced cell and the formula updates. If nothing it depends on changes, the previous result is reused.': 'غيّر خلية مرجعية لتتحدث المعادلة. إذا لم يتغير أي اعتماد، فستُستخدم النتيجة السابقة.',
    'Ask a question about your current course or paste a code snippet below.': 'اطرح سؤالًا عن دورتك الحالية أو ألصق مقطع شفرة أدناه.',
    'This is a frontend preview. AI responses will be connected in the backend phase.': 'هذه معاينة للواجهة. ستُربط استجابات الذكاء الاصطناعي في مرحلة تطوير الخلفية.',
    'Ask about your course, lesson, or code...': 'اسأل عن دورتك أو درسك أو شفرتك...',
    Send: 'إرسال',
    'LIVE LEARNING CONTEXT': 'سياق التعلم المباشر',
    'Current lesson': 'الدرس الحالي',
    'Resume lesson': 'تابع الدرس',
    'AI study coach': 'مدرب الدراسة الذكي',
    'Daily study goal': 'هدف الدراسة اليومي',
    'Create a course': 'أنشئ دورة',
    'Instructor dashboard': 'لوحة تحكم المدرس',
    'Welcome back, Dr. Sarah Chen': 'مرحبًا بعودتك، د. Sarah Chen',
    'AI Quiz Generator': 'منشئ الاختبارات الذكي',
    'Create Course': 'إنشاء دورة',
    'Total students': 'إجمالي الطلاب',
    'Active courses': 'الدورات النشطة',
    'Course completion': 'إكمال الدورة',
    'Pending reviews': 'المراجعات المعلقة',
    'Telemetric analytics': 'التحليلات عن بُعد',
    'Course performance': 'أداء الدورة',
    'Verification queue': 'قائمة التحقق',
    'Interactive AI-assisted grading': 'التقييم التفاعلي بمساعدة الذكاء الاصطناعي',
    'Pending review': 'مراجعة معلقة',
    'Submitted assignment': 'تم تسليم الواجب',
    'AI-assisted': 'بمساعدة الذكاء الاصطناعي',
    'Needs check': 'يتطلب التحقق',
    Review: 'مراجعة',
    'AI suggestion — Review before final score': 'اقتراح الذكاء الاصطناعي — راجع قبل اعتماد الدرجة النهائية',
    Confidence: 'الثقة',
    Architecture: 'البنية',
    'Test coverage': 'تغطية الاختبارات',
    'Memory safety': 'سلامة الذاكرة',
    'AI teaching assistant': 'مساعد التدريس الذكي',
    'Cognitive Prompt · Active': 'الموجه المعرفي · نشط',
    'AI Guidance': 'إرشادات الذكاء الاصطناعي',
    'Add to bank': 'أضف إلى بنك الأسئلة',
    'Edit prompt': 'تعديل الموجه',
    'Recent engagement': 'التفاعل الأخير',
    'Completed Quiz 3': 'أكمل الاختبار الثالث',
    'Submitted Capstone 2': 'سلّم المشروع الختامي الثاني',
    'awaiting review': 'بانتظار المراجعة',
    'Step 2 of 6': 'الخطوة 2 من 6',
    'Curriculum & content structure': 'المنهج وهيكل المحتوى',
    'Preview learner view': 'معاينة واجهة المتعلم',
    'Builder progress': 'تقدم الإنشاء',
    Edit: 'تعديل',
    'Add lesson': 'إضافة درس',
    'AI CURRICULUM ASSISTANT': 'مساعد المناهج الذكي',
    'Course health score': 'مؤشر جودة الدورة',
    'Optimal structure': 'هيكل مثالي',
    'Generate lesson quiz': 'إنشاء اختبار للدرس',
    'Total registered users': 'إجمالي المستخدمين المسجلين',
    'AI inferences': 'استدلالات الذكاء الاصطناعي',
    'Course catalog': 'كتالوج الدورات',
    'Platform ARR': 'الإيرادات السنوية المتكررة للمنصة',
    'Lock down safeguards': 'تفعيل إجراءات الحماية',
    'Unlock safeguards': 'إلغاء قفل إجراءات الحماية',
    'Invite enterprise tenant': 'دعوة مؤسسة',
    'Invite user': 'دعوة مستخدم',
    User: 'المستخدم',
    'Total platform users': 'إجمالي مستخدمي المنصة',
    'Across 3 user roles': 'عبر 3 أدوار للمستخدمين',
    'Curriculum status': 'حالة المناهج',
    '108 published · 12 in review': '108 منشورة · 12 قيد المراجعة',
    'Monthly AI inferences': 'استدلالات الذكاء الاصطناعي الشهرية',
    'Average latency 240ms': 'متوسط زمن الاستجابة 240 مللي ثانية',
    'Platform gross ARR': 'إجمالي الإيرادات السنوية المتكررة للمنصة',
    'Identity & tenant verification': 'التحقق من الهوية والمؤسسة',
    'Curriculum moderation': 'مراجعة المناهج',
    'Pedagogical audit': 'التدقيق التربوي',
    'Security overview': 'نظرة عامة على الأمان',
    'AI compute & telemetry': 'حوسبة الذكاء الاصطناعي والقياس عن بُعد',
    'AI security': 'أمان الذكاء الاصطناعي',
    'Model integrity': 'سلامة النموذج',
    'Token protection': 'حماية الرموز',
    'Platform alerts': 'تنبيهات المنصة',
    'Live system feed': 'تدفق النظام المباشر',
    'Role escalation': 'تصعيد الدور',
    'Auto-approved for educational staff.': 'تمت الموافقة تلقائيًا للموظفين التعليميين.',
    'SecOps audit': 'تدقيق العمليات الأمنية',
    '1 flagged anomaly in tenant activity.': 'تم رصد حالة شاذة واحدة في نشاط المؤسسة.',
    'API latency': 'زمن استجابة واجهة API',
    'Operational': 'يعمل بشكل طبيعي',
    'Approve': 'موافقة',
    'Request revision': 'طلب تعديل',
    },
    {
      'Explore the platform': 'استكشف المنصة',
      'Browse all courses': 'تصفح جميع الدورات',
      'Make ambitious learning feel': 'اجعل التعلم الطموح يبدو',
      'possible.': 'ممكنًا.',
      'NexaLearn helps people build practical technology skills through a clear learning path, hands-on work, and guidance that meets them where they are.': 'تساعد NexaLearn المتعلمين على اكتساب مهارات تقنية عملية من خلال مسار واضح وتطبيق عملي وإرشاد يناسب احتياجاتهم.',
      'Start with people': 'ابدأ بالاهتمام بالناس',
      'Good learning experiences respect different backgrounds, schedules, and ways of approaching a new subject. We aim to make the next step clear without making the journey feel rigid.': 'تحترم تجارب التعلم الجيدة اختلاف الخلفيات والجداول الزمنية وطرق تناول الموضوعات الجديدة. نهدف إلى توضيح الخطوة التالية دون جعل رحلة التعلم جامدة.',
      'Learn through practice': 'تعلم من خلال التطبيق',
      'Understanding grows when learners apply ideas. Courses connect foundational concepts to exercises, projects, and examples that resemble real technical work.': 'يتعمق الفهم عندما يطبق المتعلمون الأفكار. تربط الدورات المفاهيم الأساسية بتمارين ومشاريع وأمثلة تحاكي العمل التقني الواقعي.',
      'Use AI thoughtfully': 'استخدم الذكاء الاصطناعي بوعي',
      'AI can explain, suggest, and help learners get unstuck. It should support curiosity and independent judgment—not replace careful thinking or verification.': 'يمكن للذكاء الاصطناعي الشرح والاقتراح ومساعدة المتعلمين على تجاوز العقبات. ينبغي أن يدعم الفضول والحكم المستقل، لا أن يحل محل التفكير المتأني والتحقق.',
      'A SIMPLE LEARNING LOOP': 'حلقة تعلم بسيطة',
      'Learn it. Try it. Reflect. Repeat.': 'تعلم. جرّب. تأمل. كرر.',
      'Start with a focused lesson, apply the idea in a small task, then use feedback to decide what to practice next. This cycle helps turn information into skills that are easier to remember and use.': 'ابدأ بدرس مركز، وطبق الفكرة في مهمة صغيرة، ثم استخدم الملاحظات لتحديد ما ستتدرب عليه لاحقًا. تساعد هذه الدورة على تحويل المعلومات إلى مهارات يسهل تذكرها واستخدامها.',
      'Explore the course catalog': 'استكشف كتالوج الدورات',
      'Welcome back': 'مرحبًا بعودتك',
      'YOUR LEARNING, RIGHT WHERE YOU LEFT IT': 'تعلمك، من حيث توقفت',
      'YOUR NEXT CHAPTER STARTS HERE': 'فصلك القادم يبدأ هنا',
      'MAKE ROOM FOR WHAT’S NEXT': 'افسح المجال لما هو قادم',
      'Small steps.': 'خطوات صغيرة.',
      'Remarkable progress.': 'تقدم استثنائي.',
      'Build skills that move you forward, one focused learning session at a time.': 'اكتسب مهارات تدفعك إلى الأمام، جلسة تعلم مركزة تلو الأخرى.',
      'Learning paths shaped around your goals': 'مسارات تعلم مصممة حول أهدافك',
      'Guidance when you need a hand': 'إرشاد عندما تحتاج إلى المساعدة',
      'Progress you can see and celebrate': 'تقدم يمكنك رؤيته والاحتفاء به',
      'Every expert was once a beginner.': 'كان كل خبير مبتدئًا يومًا ما.',
      'Sign in to pick up where your curiosity left off.': 'سجّل الدخول لمتابعة رحلة فضولك من حيث توقفت.',
      'A brighter learning journey starts with one small step.': 'تبدأ رحلة تعلم أكثر إشراقًا بخطوة صغيرة.',
      'New to NexaLearn?': 'هل أنت جديد في NexaLearn؟',
      'Create a free account': 'أنشئ حسابًا مجانيًا',
      'Already learning with us?': 'هل تتعلم معنا بالفعل؟',
      'Open menu': 'افتح القائمة',
      'Close menu': 'أغلق القائمة',
      'Continue your learning journey.': 'تابع رحلتك التعليمية.',
      'Start building your future with AI-powered learning.': 'ابدأ ببناء مستقبلك بالتعلم المدعوم بالذكاء الاصطناعي.',
      'Email address': 'البريد الإلكتروني',
      'Password': 'كلمة المرور',
      'Remember me': 'تذكرني',
      'Forgot password?': 'هل نسيت كلمة المرور؟',
      'Create account': 'إنشاء حساب',
      'or continue with': 'أو تابع باستخدام',
      'Continue with Google': 'المتابعة باستخدام Google',
      "Don't have an account?": 'ليس لديك حساب؟',
      'Create one free': 'أنشئ حسابًا مجانًا',
      'Already have an account?': 'لديك حساب بالفعل؟',
      'you@example.com': 'you@example.com',
      'Enter your password': 'أدخل كلمة المرور',
      'Search courses': 'ابحث عن الدورات',
      'No users match this role.': 'لا يوجد مستخدمون بهذا الدور.',
      Action: 'الإجراء',
      '3 critical': '3 حالات حرجة',
      'Total registered users': 'إجمالي المستخدمين المسجلين',
      'avg latency 240ms': 'متوسط زمن الاستجابة 240 مللي ثانية',
      '108 published': '108 منشورة',
      'Course performance': 'أداء الدورة',
      '30 days': '30 يومًا',
      Enrolled: 'مسجل',
      Started: 'بدأ',
      Completed: 'مكتمل',
      'Create a course': 'أنشئ دورة',
      'Your personalized track': 'مسارك المخصص',
      'A focused path from web foundations to production-ready AI applications.': 'مسار مركز يبدأ بأساسيات الويب وينتهي بتطبيقات ذكاء اصطناعي جاهزة للإنتاج.',
      'Current streak': 'سلسلة الاستمرارية الحالية',
      'THE JOURNEY': 'الرحلة',
      Milestones: 'الإنجازات',
      '4 milestones remaining': 'تبقت 4 إنجازات',
      'Frontend Engineer': 'مهندس واجهات أمامية',
      'Data Scientist': 'عالم بيانات',
      Closures: 'الإغلاقات',
      'Component architecture': 'بنية المكونات',
      'Signals & RxJS': 'الإشارات وRxJS',
      'HTTP & WebSockets': 'HTTP وWebSockets',
      'Lesson video': 'فيديو الدرس',
      'Mark complete & continue': 'أكمل وتابع',
      'Lesson marked complete. Your course progress is ready to sync.': 'تم تحديد الدرس كمكتمل. تقدم الدورة جاهز للمزامنة.',
      'Course health score': 'مؤشر جودة الدورة',
      'Enterprise tenant invitation opened. Connect the admin service to send invitations.': 'تم فتح دعوة المؤسسة. اربط خدمة الإدارة لإرسال الدعوات.',
      'User invitation opened. Connect the admin service to send invitations.': 'تم فتح دعوة المستخدم. اربط خدمة الإدارة لإرسال الدعوات.',
      'Platform safeguards are locked in this preview.': 'إجراءات حماية المنصة مقفلة في هذه المعاينة.',
      'Platform safeguards are unlocked in this preview.': 'إجراءات حماية المنصة غير مقفلة في هذه المعاينة.',
      'Prompt editing is ready. Connect an instructor content service to save changes.': 'تحرير الموجه جاهز. اربط خدمة محتوى المدرس لحفظ التغييرات.',
      'The AI teaching prompt was added to the question bank preview.': 'تمت إضافة موجه التدريس الذكي إلى معاينة بنك الأسئلة.',
      'New tutor dialogue started.': 'بدأت محادثة جديدة مع المعلم.',
      'Enter a question before sending it to the tutor.': 'أدخل سؤالًا قبل إرساله إلى المعلم.',
      'Message added to this tutor preview. AI responses require a connected backend.': 'أضيفت الرسالة إلى معاينة المعلم. تتطلب استجابات الذكاء الاصطناعي ربط الواجهة الخلفية.',
      'Answer saved in this preview. The next question is ready.': 'تم حفظ الإجابة في هذه المعاينة. السؤال التالي جاهز.',
      'Choose an answer to continue.': 'اختر إجابة للمتابعة.',
      'A new draft module was added to the curriculum.': 'تمت إضافة وحدة مسودة جديدة إلى المنهج.',
      'New module': 'وحدة جديدة',
      'Published': 'منشور',
      'Active editing': 'قيد التحرير',
      Draft: 'مسودة',
      'Revision requested': 'طُلب التعديل',
      Approved: 'تمت الموافقة',
      'Getting started': 'البدء',
      'Platform governance': 'حوكمة المنصة',
      'Learning workspace': 'مساحة التعلم',
      'Student dashboard': 'لوحة تحكم الطالب',
      'Course player': 'مشغل الدورة',
      'Progress analytics': 'تحليلات التقدم',
      'Curriculum builder': 'منشئ المناهج',
      'Admin governance': 'حوكمة الإدارة',
      'Discover practical courses taught by industry experts.': 'اكتشف دورات عملية يقدمها خبراء الصناعة.',
      'Personalized learning paths and intelligent tutoring for ambitious builders.': 'مسارات تعلم مخصصة وتعليم ذكي للمبدعين الطموحين.',
      'Your enrolled courses and progress.': 'دوراتك المسجل بها وتقدمك.',
      'Follow a roadmap designed around your goals.': 'اتبع خارطة طريق مصممة حول أهدافك.',
      'Your always-on intelligent learning companion.': 'رفيقك التعليمي الذكي المتاح دائمًا.',
      'Generate practice quizzes tailored to your learning goals.': 'أنشئ اختبارات تدريبية تناسب أهدافك التعليمية.',
      'Understand and debug code with an AI assistant.': 'افهم الشفرة وصحح أخطاءها بمساعدة مساعد ذكي.',
      'Submit work and track feedback.': 'سلم أعمالك وتابع الملاحظات.',
      'Understand your learning momentum.': 'افهم زخمك التعليمي.',
      'Manage courses and learner outcomes.': 'أدر الدورات ونتائج المتعلمين.',
      'Create engaging course curriculum.': 'أنشئ منهجًا دراسيًا تفاعليًا.',
      'Manage your learning organization securely.': 'أدر مؤسستك التعليمية بأمان.',
      'JavaScript Mastery & Modern ES6+': 'إتقان JavaScript وES6+ الحديثة',
      'Python for Data Science': 'بايثون لعلم البيانات',
      'AI Fundamentals': 'أساسيات الذكاء الاصطناعي',
      'Angular 20: Reactive Applications': 'Angular 20: التطبيقات التفاعلية',
      'JavaScript Mastery': 'إتقان JavaScript',
      Development: 'التطوير',
      'Data Science': 'علم البيانات',
      'Artificial Intelligence': 'الذكاء الاصطناعي',
      'Go from modern syntax to production-ready JavaScript by building reliable, tested web applications.': 'انتقل من فهم الصياغة الحديثة إلى JavaScript جاهزة للإنتاج عبر بناء تطبيقات ويب موثوقة ومختبرة.',
      'Turn raw datasets into clear, reproducible insights using Python, pandas, and practical visualization.': 'حوّل مجموعات البيانات الخام إلى رؤى واضحة قابلة لإعادة الإنتاج باستخدام Python وpandas والتصور العملي.',
      'Understand how modern AI works and create useful, responsible AI prototypes without needing a math-heavy background.': 'افهم آلية عمل الذكاء الاصطناعي الحديث وأنشئ نماذج أولية مفيدة ومسؤولة دون الحاجة إلى خلفية رياضية مكثفة.',
      'Architect a fast, accessible Angular application with standalone components, signals, routing, and robust testing.': 'صمم تطبيق Angular سريعًا وسهل الوصول باستخدام مكونات مستقلة وإشارات وتوجيه واختبارات قوية.',
      'Write expressive ES2024 code with confidence': 'اكتب شفرات ES2024 واضحة بثقة',
      'Model data with objects, collections, and modules': 'نمذج البيانات باستخدام الكائنات والمجموعات والوحدات',
      'Build asynchronous features with promises and fetch': 'أنشئ ميزات غير متزامنة باستخدام الوعود وfetch',
      'Test, debug, and ship maintainable applications': 'اختبر التطبيقات وصحح أخطاءها وانشرها مع الحفاظ على سهولة صيانتها',
      'Load, clean, and validate real-world datasets': 'حمّل مجموعات بيانات واقعية ونظفها وتحقق من صحتها',
      'Explore trends with pandas and NumPy': 'استكشف الاتجاهات باستخدام pandas وNumPy',
      'Create clear visual stories from data': 'أنشئ قصصًا مرئية واضحة من البيانات',
      'Present reproducible analysis notebooks': 'اعرض دفاتر تحليل قابلة لإعادة الإنتاج',
      'Explain the core ideas behind machine learning': 'اشرح الأفكار الأساسية وراء تعلم الآلة',
      'Choose suitable AI approaches for common tasks': 'اختر أساليب ذكاء اصطناعي مناسبة للمهام الشائعة',
      'Design effective prompts and evaluate outputs': 'صمم موجهات فعالة وقيّم النتائج',
      'Build a responsible AI-powered prototype': 'أنشئ نموذجًا أوليًا مسؤولًا مدعومًا بالذكاء الاصطناعي',
      'Structure applications with standalone Angular components': 'نظم التطبيقات باستخدام مكونات Angular مستقلة',
      'Model reactive state with signals and RxJS': 'نمذج الحالة التفاعلية باستخدام الإشارات وRxJS',
      'Build routed forms and data-driven interfaces': 'أنشئ نماذج موجهة وواجهات قائمة على البيانات',
      'Test and optimize accessible production applications': 'اختبر وحسّن تطبيقات إنتاج سهلة الوصول',
    },
    {
      'HOW NEXALEARN WORKS': 'كيف تعمل NexaLearn',
      'NexaLearn brings course material, practice, and feedback into one guided experience. Start with a goal, follow a focused sequence, and use projects to turn new concepts into durable skills.': 'تجمع NexaLearn مواد الدورات والتدريب والملاحظات في تجربة تعليمية موجهة. ابدأ بهدف، واتبع تسلسلًا مركزًا، واستخدم المشاريع لتحويل المفاهيم الجديدة إلى مهارات راسخة.',
      'Browse role-focused subjects and pick a learning direction that fits your experience and ambitions.': 'تصفح موضوعات مرتبطة بالأدوار المهنية واختر مسار تعلم يناسب خبرتك وطموحاتك.',
      'Short lessons pair explanations with practical exercises, project milestones, and examples you can revisit.': 'تجمع الدروس القصيرة بين الشروحات والتمارين العملية ومراحل المشاريع والأمثلة التي يمكنك مراجعتها.',
      'Use progress signals and optional AI guidance to decide what to review and what to tackle next.': 'استخدم مؤشرات التقدم والإرشاد الاختياري بالذكاء الاصطناعي لتحديد ما ستراجعه وما ستبدأ به لاحقًا.',
      'Compare courses by subject, level, time commitment, and practical outcomes. Search the catalog for a tool or skill, then open a course to review its modules before choosing where to begin.': 'قارن الدورات حسب الموضوع والمستوى والوقت والنتائج العملية. ابحث عن أداة أو مهارة في الكتالوج، ثم افتح الدورة لمراجعة وحداتها قبل اختيار نقطة البداية.',
      'Match your starting point': 'اختر ما يناسب مستواك',
      'Beginner, intermediate, and advanced labels help you select material that is appropriately challenging.': 'تساعدك مستويات مبتدئ ومتوسط ومتقدم على اختيار محتوى يوفر تحديًا مناسبًا.',
      'Check the time commitment': 'تحقق من الوقت المطلوب',
      'Lesson counts and estimated durations make it easier to plan learning around work or study.': 'تساعدك أعداد الدروس ومددها التقديرية على تنظيم التعلم إلى جانب العمل أو الدراسة.',
      'Review projects, tools, instructor information, and learning outcomes before committing to a course.': 'راجع المشاريع والأدوات ومعلومات المدرس ونتائج التعلم قبل التسجيل في الدورة.',
      'LEARNER DASHBOARD': 'لوحة المتعلم',
      'Turn your learning activity into a useful plan': 'حوّل نشاطك التعليمي إلى خطة مفيدة',
      'The dashboard brings current courses, recent activity, and key progress signals together so you can pick up quickly and spend your next session on a concrete task.': 'تجمع لوحة التحكم دوراتك الحالية ونشاطك الأخير ومؤشرات التقدم الرئيسية لتتمكن من المتابعة بسرعة وتخصيص جلستك القادمة لمهمة محددة.',
      'Resume without searching': 'تابع دون بحث',
      'Your in-progress course and next lesson are surfaced alongside direct links to your course library.': 'تظهر دورتك الجارية والدرس التالي إلى جانب روابط مباشرة إلى مكتبة دوراتك.',
      'Keep momentum visible': 'تابع زخمك',
      'Streaks, study time, completion, and assessment results help you notice consistent progress.': 'تساعدك سلاسل التعلم ووقت الدراسة والإكمال ونتائج التقييم على ملاحظة تقدمك المستمر.',
      'Plan the next session': 'خطط لجلستك القادمة',
      'Upcoming work and recent activity make deadlines and useful review tasks easier to spot.': 'يساعدك العمل القادم والنشاط الأخير على تحديد المواعيد النهائية ومهام المراجعة المفيدة.',
      'YOUR LEARNING ACCOUNT': 'حسابك التعليمي',
      'Keep your courses and progress together': 'اجمع دوراتك وتقدمك في مكان واحد',
      'An account is the starting point for a continuous learning workspace. Sign in to return to saved progress, or create an account to begin organizing courses and milestones in one place.': 'الحساب هو نقطة البداية لمساحة تعلم متصلة. سجل الدخول للعودة إلى تقدمك المحفوظ، أو أنشئ حسابًا لتنظيم الدورات والإنجازات في مكان واحد.',
      'Return to your course': 'عد إلى دورتك',
      'Continue from your current lesson instead of rebuilding your place each time you visit.': 'تابع من درسك الحالي بدلًا من إعادة تحديد موضعك في كل زيارة.',
      'Keep goals in view': 'أبقِ أهدافك واضحة',
      'Use a personal dashboard to follow course activity, upcoming assignments, and learning streaks.': 'استخدم لوحة شخصية لمتابعة نشاط الدورة والواجبات القادمة وسلاسل التعلم.',
      'Get guided practice': 'احصل على تدريب موجه',
      'Connect course work with quizzes, progress reports, and tutor tools when available.': 'اربط مهام الدورة بالاختبارات وتقارير التقدم وأدوات المعلم عند توفرها.',
      'ABOUT NEXALEARN AI': 'عن NexaLearn AI',
      'Technology learning built around real progress': 'تعلم تقني يركز على التقدم الحقيقي',
      'NexaLearn is designed to make ambitious technical goals feel approachable. We combine structured curricula with hands-on work and clear feedback, so learners can move from understanding a concept to using it confidently.': 'صُممت NexaLearn لجعل الأهداف التقنية الطموحة في متناول الجميع. نجمع المناهج المنظمة مع التطبيق العملي والملاحظات الواضحة، لينتقل المتعلم من فهم المفهوم إلى استخدامه بثقة.',
      'Start with the learner': 'ابدأ بالمتعلم',
      'Clear explanations and flexible pacing help learners with different backgrounds find a productive starting point.': 'تساعد الشروحات الواضحة والوتيرة المرنة المتعلمين من خلفيات مختلفة على إيجاد نقطة بداية مثمرة.',
      'Practice with purpose': 'تدرب بهدف',
      'Projects and exercises connect foundational ideas to the kinds of work developers and analysts actually do.': 'تربط المشاريع والتمارين الأفكار الأساسية بالمهام التي ينفذها المطورون والمحللون فعليًا.',
      'Use AI as a guide': 'استخدم الذكاء الاصطناعي كمرشد',
      'AI support is intended to clarify concepts and suggest next steps while keeping learner judgment at the center.': 'يهدف دعم الذكاء الاصطناعي إلى توضيح المفاهيم واقتراح الخطوات التالية مع إبقاء حكم المتعلم في المقام الأول.',
      'YOUR LEARNING WORKSPACE': 'مساحة التعلم الخاصة بك',
      'Make every study session count': 'اجعل كل جلسة دراسة مثمرة',
      'STUDENT ACCOUNT': 'حساب الطالب',
      'Student account access is enabled. Use this workspace to jump into your dashboard, review your courses, and track your pace across the platform.': 'تم تفعيل حساب الطالب. استخدم مساحة العمل هذه للانتقال إلى لوحة التحكم ومراجعة دوراتك ومتابعة وتيرتك عبر المنصة.',
      'Launch your learning dashboard': 'افتح لوحة التعلم',
      'Check course momentum, upcoming deadlines, and recent activity from one place.': 'تابع تقدم الدورة والمواعيد النهائية القادمة والنشاط الأخير من مكان واحد.',
      'Access the student pages you need': 'افتح صفحات الطالب التي تحتاجها',
      'Move between your dashboard, course library, progress analytics, and AI tutor quickly.': 'انتقل بسرعة بين لوحة التحكم ومكتبة الدورات وتحليلات التقدم والمعلم الذكي.',
      'Stay on track with feedback': 'حافظ على مسارك باستخدام الملاحظات',
      'Use course notes, analytics, and practice tools to decide the next action for your next study session.': 'استخدم ملاحظات الدورة والتحليلات وأدوات التدريب لتحديد خطوتك التالية في جلسة الدراسة القادمة.',
      'YOUR COURSE LIBRARY': 'مكتبة دوراتك',
      'Organize what you are learning now': 'نظم ما تتعلمه الآن',
      'Your library is the home for active and completed study. Search by course title or subject, check completion at a glance, and reopen a course when you are ready to continue.': 'مكتبتك هي موطن دراستك النشطة والمكتملة. ابحث بعنوان الدورة أو موضوعها، وتحقق من الإكمال بسرعة، وأعد فتح الدورة عندما تكون مستعدًا للمتابعة.',
      'Find a course quickly': 'اعثر على دورة بسرعة',
      'Use the search field to narrow your list by course name or subject area.': 'استخدم حقل البحث لتصفية القائمة حسب اسم الدورة أو مجالها.',
      'See your progress': 'اطلع على تقدمك',
      'Completion indicators and lesson totals help you understand how much work remains.': 'تساعدك مؤشرات الإكمال وإجمالي الدروس على معرفة مقدار العمل المتبقي.',
      'Choose a next step': 'اختر خطوتك التالية',
      'Continue an active course or visit the catalog to find a new subject that supports your goals.': 'تابع دورة نشطة أو زر الكتالوج للعثور على موضوع جديد يدعم أهدافك.',
      'PERSONALIZED LEARNING PATH': 'مسار تعلم مخصص',
      'Connect today’s lesson to a longer-term goal': 'اربط درس اليوم بهدف بعيد المدى',
      'The roadmap breaks a career direction into milestones, from foundational knowledge through applied projects. Adjust the target role or weekly commitment to make the plan better fit your schedule.': 'تقسم خارطة الطريق المسار المهني إلى إنجازات تبدأ بالمعرفة الأساسية وتنتهي بالمشاريع التطبيقية. عدّل الدور المستهدف أو الالتزام الأسبوعي ليتناسب مع جدولك.',
      'Follow a sensible sequence': 'اتبع تسلسلًا منطقيًا',
      'Milestones build on earlier skills so new topics have a clear foundation.': 'تبني الإنجازات على المهارات السابقة لتستند الموضوعات الجديدة إلى أساس واضح.',
      'Set a sustainable pace': 'حدد وتيرة مستدامة',
      'A weekly study commitment makes the target date easier to plan around and revisit.': 'يساعدك الالتزام بالدراسة أسبوعيًا على التخطيط للموعد المستهدف ومراجعته.',
      'Spot skills you have unlocked': 'تعرف على المهارات التي اكتسبتها',
      'The skills panel connects completed work to practical capabilities you can continue developing.': 'تربط لوحة المهارات الأعمال المكتملة بالقدرات العملية التي يمكنك مواصلة تطويرها.',
      'GUIDED COURSE PLAYER': 'مشغل الدورات الموجه',
      'Learn a concept, then apply it immediately': 'تعلم مفهومًا ثم طبقه فورًا',
      'Use the lesson player to focus on one idea at a time. Follow the explanation, review the worked example, and use the syllabus to move between related topics without losing the course sequence.': 'استخدم مشغل الدروس للتركيز على فكرة واحدة في كل مرة. تابع الشرح وراجع المثال التطبيقي واستخدم المنهج للتنقل بين الموضوعات المرتبطة دون فقدان تسلسل الدورة.',
      'Build understanding in steps': 'ابنِ فهمك خطوة بخطوة',
      'Lessons introduce a core idea before adding related concepts and implementation details.': 'تقدم الدروس فكرة أساسية قبل إضافة المفاهيم المرتبطة وتفاصيل التنفيذ.',
      'Study the example': 'ادرس المثال',
      'Code snippets and concise notes help connect the explanation to a pattern you can reuse.': 'تساعدك مقاطع الشفرة والملاحظات الموجزة على ربط الشرح بنمط يمكنك إعادة استخدامه.',
      'Keep your place': 'احتفظ بموضعك',
      'The syllabus shows how this lesson fits into the wider module and course.': 'يوضح المنهج موضع هذا الدرس ضمن الوحدة والدورة.',
      'AI TUTORING WORKSPACE': 'مساحة المعلم الذكي',
      'Ask focused questions while you learn': 'اطرح أسئلة مركزة أثناء التعلم',
      'Use the tutor to clarify a confusing term, compare approaches, or request a hint for a course exercise. The most useful prompts include the topic you are studying and what you have already tried.': 'استخدم المعلم لتوضيح مصطلح محير أو مقارنة الأساليب أو طلب تلميح لتمرين الدورة. تتضمن الموجهات المفيدة الموضوع الذي تدرسه وما جربته بالفعل.',
      'Ask for an explanation': 'اطلب شرحًا',
      'Request a plain-language walkthrough of a concept, then ask follow-up questions about individual steps.': 'اطلب شرحًا مبسطًا للمفهوم، ثم اطرح أسئلة متابعة حول كل خطوة.',
      'Get a hint before a solution': 'اطلب تلميحًا قبل الحل',
      'Use progressive hints to keep the problem-solving work in your hands.': 'استخدم تلميحات تدريجية لتبقى عملية حل المشكلة بين يديك.',
      'Stay aligned with your course': 'ابقَ متوافقًا مع دورتك',
      'Course context helps focus a question on the concepts and terminology you are currently learning.': 'يساعد سياق الدورة على تركيز السؤال على المفاهيم والمصطلحات التي تتعلمها حاليًا.',
      'PRACTICE & KNOWLEDGE CHECK': 'التدريب والتحقق من المعرفة',
      'Use retrieval practice to strengthen understanding': 'استخدم الاسترجاع لتعزيز الفهم',
      'Work through one question at a time, choose an answer, and use the explanation to identify what to review. A quiz is most useful as a learning signal, not just a score.': 'أجب عن سؤال واحد في كل مرة، واختر إجابة، واستخدم الشرح لتحديد ما تحتاج إلى مراجعته. يكون الاختبار أكثر فائدة كمؤشر للتعلم، لا كدرجة فقط.',
      'Think before revealing': 'فكر قبل إظهار الإجابة',
      'Commit to an answer and explain your reasoning to yourself before moving to the next question.': 'اختر إجابة واشرح لنفسك سبب اختيارك قبل الانتقال إلى السؤال التالي.',
      'Review the concept behind a choice': 'راجع المفهوم وراء الاختيار',
      'Answer details point back to the mental model or rule that distinguishes a strong choice.': 'تعيدك تفاصيل الإجابة إلى النموذج الذهني أو القاعدة التي تميز الاختيار الصحيح.',
      'Turn gaps into a study plan': 'حوّل الفجوات إلى خطة دراسة',
      'Use diagnostic notes to revisit topics that need another example or a slower walkthrough.': 'استخدم الملاحظات التشخيصية لمراجعة الموضوعات التي تحتاج إلى مثال آخر أو شرح أبطأ.',
      'CODE REVIEW & EXPLANATION': 'مراجعة الشفرة وشرحها',
      'Understand the reason behind a code change': 'افهم سبب تغيير الشفرة',
      'The code explainer highlights potential issues, explains their impact, and shows safer alternatives. Treat its output as a review aid: check assumptions, validate behavior, and run tests in your project.': 'يوضح مفسر الشفرة المشكلات المحتملة ويشرح أثرها ويعرض بدائل أكثر أمانًا. استخدم نتائجه للمراجعة: تحقق من الافتراضات والسلوك وشغل الاختبارات في مشروعك.',
      'Read the finding in context': 'اقرأ النتيجة في سياقها',
      'Severity and issue descriptions help distinguish correctness concerns from optional improvements.': 'تساعدك الخطورة وأوصاف المشكلات على التمييز بين مسائل الصحة والتحسينات الاختيارية.',
      'Study the suggested pattern': 'ادرس النمط المقترح',
      'A small corrected example can make asynchronous behavior and data handling easier to reason about.': 'يساعدك مثال مصحح صغير على فهم السلوك غير المتزامن ومعالجة البيانات.',
      'Verify before adopting': 'تحقق قبل الاعتماد',
      'Confirm the recommendation against your requirements, types, tests, and actual runtime behavior.': 'تحقق من التوصية بمقارنتها بمتطلباتك وأنواع البيانات والاختبارات وسلوك التشغيل الفعلي.',
      'PROJECTS & SUBMISSIONS': 'المشاريع والتسليمات',
      'Apply course ideas to work you can review': 'طبق أفكار الدورة في عمل قابل للمراجعة',
      'Assignments turn lesson concepts into concrete deliverables. Check the due date and rubric, break larger work into small steps, and use feedback to decide what to improve next.': 'تحول الواجبات مفاهيم الدروس إلى مخرجات ملموسة. تحقق من الموعد ومعايير التقييم، وقسم العمل الكبير إلى خطوات صغيرة، واستخدم الملاحظات لتحديد ما ستطوره.',
      'Prioritize upcoming work': 'رتب أولويات العمل القادم',
      'Sort attention by due date and course so you can start the most time-sensitive task early.': 'رتب اهتمامك حسب الموعد والدورة لتبدأ المهام الأكثر إلحاحًا مبكرًا.',
      'Show your reasoning': 'وضح طريقة تفكيرك',
      'Clear implementation notes and focused tests help reviewers understand how your solution works.': 'تساعد ملاحظات التنفيذ الواضحة والاختبارات المركزة المراجعين على فهم آلية عمل الحل.',
      'Use feedback as a next step': 'استخدم الملاحظات لتحديد الخطوة التالية',
      'Evaluation notes point to strengths to keep and specific areas to practice again.': 'توضح ملاحظات التقييم نقاط القوة التي ينبغي الحفاظ عليها ومجالات محددة تحتاج إلى مزيد من التدريب.',
      'LEARNING ANALYTICS': 'تحليلات التعلم',
      'Look beyond completion to understand your momentum': 'تجاوز نسبة الإكمال لفهم زخمك',
      'Progress combines time, consistency, assessment quality, and skill development. Compare trends over a useful time range, then use a specific finding to shape your next study session.': 'يجمع التقدم بين الوقت والاستمرارية وجودة التقييم وتطوير المهارات. قارن الاتجاهات خلال فترة مناسبة، ثم استخدم نتيجة محددة لتخطيط جلسة الدراسة التالية.',
      'Notice changes in study rhythm': 'لاحظ التغيرات في وتيرة الدراسة',
      'Weekly activity makes it easier to see whether your current routine is sustainable.': 'يسهل النشاط الأسبوعي معرفة مدى استدامة روتينك الحالي.',
      'Identify skills to strengthen': 'حدد المهارات التي تحتاج إلى تعزيز',
      'Skill indicators help separate comfortable topics from topics that still need practice.': 'تساعد مؤشرات المهارات على تمييز الموضوعات التي تتقنها من الموضوعات التي تحتاج إلى تدريب.',
      'Compare progress across courses': 'قارن التقدم بين الدورات',
      'Course velocity offers a quick view of where effort is translating into completion.': 'يوفر معدل تقدم الدورة لمحة سريعة عن المواضع التي يتحول فيها الجهد إلى إنجاز.',
      'INSTRUCTOR TEACHING WORKSPACE': 'مساحة عمل المدرس',
      'Support learners with timely, actionable guidance': 'ادعم المتعلمين بإرشادات مناسبة وقابلة للتنفيذ',
      'The instructor dashboard brings course health, learner activity, and grading priorities together. Use it to decide where a small intervention can remove friction for the largest number of learners.': 'تجمع لوحة المدرس صحة الدورات ونشاط المتعلمين وأولويات التقييم. استخدمها لتحديد المواضع التي يمكن لتدخل بسيط فيها إزالة العقبات أمام أكبر عدد من المتعلمين.',
      'Monitor course health': 'راقب صحة الدورة',
      'Enrollment, completion, and feedback signals help you spot material that may need clarification.': 'تساعدك مؤشرات التسجيل والإكمال والملاحظات على اكتشاف المحتوى الذي قد يحتاج إلى توضيح.',
      'Prioritize learner reviews': 'رتب أولويات مراجعة أعمال المتعلمين',
      'Submission queues and deadlines make it easier to focus on work that needs timely feedback.': 'تسهل قوائم التسليم والمواعيد النهائية التركيز على الأعمال التي تحتاج إلى ملاحظات في الوقت المناسب.',
      'Improve teaching material': 'حسّن المواد التعليمية',
      'Use learner questions and AI-assisted drafts as inputs to review and refine your curriculum.': 'استخدم أسئلة المتعلمين والمسودات المدعومة بالذكاء الاصطناعي لمراجعة المنهج وتحسينه.',
      'COURSE AUTHORING WORKSPACE': 'مساحة إنشاء الدورات',
      'Shape a curriculum learners can navigate': 'صمم منهجًا يسهل على المتعلمين اتباعه',
      'The builder organizes course content into modules and lessons. Keep each unit focused, make the sequence explicit, and check the learner preview to see how your structure reads outside the authoring view.': 'ينظم المنشئ محتوى الدورة في وحدات ودروس. حافظ على تركيز كل وحدة، ووضح التسلسل، وراجع معاينة المتعلم لمعرفة شكل المنهج خارج شاشة الإنشاء.',
      'Create a learning sequence': 'أنشئ تسلسلًا تعليميًا',
      'Order modules so foundational ideas appear before the tasks that depend on them.': 'رتب الوحدات بحيث تسبق الأفكار الأساسية المهام المعتمدة عليها.',
      'Balance depth and pace': 'وازن بين العمق والوتيرة',
      'Lesson counts and durations help learners estimate effort and find manageable checkpoints.': 'تساعد أعداد الدروس ومددها المتعلمين على تقدير الجهد والعثور على نقاط تقدم مناسبة.',
      'Review before publishing': 'راجع قبل النشر',
      'Preview the learner experience and use course-health feedback to find gaps in the structure.': 'عاين تجربة المتعلم واستخدم ملاحظات صحة الدورة لاكتشاف الثغرات في الهيكل.',
      'PLATFORM GOVERNANCE': 'حوكمة المنصة',
      'Manage access, quality, and operational health': 'أدر الوصول والجودة والصحة التشغيلية',
      'The governance workspace brings identity, curriculum review, platform signals, and safeguards into one operational view. Use role filters to investigate a focused set of accounts and review alerts with appropriate care.': 'تجمع مساحة الحوكمة الهوية ومراجعة المناهج ومؤشرات المنصة وإجراءات الحماية في عرض تشغيلي واحد. استخدم مرشحات الأدوار لمراجعة مجموعة محددة من الحسابات وتعامل مع التنبيهات بعناية.',
      'Keep access understandable': 'اجعل صلاحيات الوصول واضحة',
      'Review user roles and account status to maintain clear, accountable access across the organization.': 'راجع أدوار المستخدمين وحالة الحسابات للحفاظ على صلاحيات واضحة وخاضعة للمساءلة في المؤسسة.',
      'Protect learning quality': 'احمِ جودة التعلم',
      'Curriculum and moderation queues surface material that needs a human review.': 'تعرض قوائم مراجعة المناهج والإشراف المواد التي تتطلب مراجعة بشرية.',
      'Watch service health': 'راقب صحة الخدمات',
      'Operational indicators help teams notice reliability or security signals that may need follow-up.': 'تساعد المؤشرات التشغيلية الفرق على ملاحظة إشارات الموثوقية أو الأمان التي قد تحتاج إلى متابعة.',

      // Landing Page - Hero & Quick Demo
      'Neural Learning Platform · Powered by Gemini 2.5': 'منصة تعلم عصبية · مدعومة بـ Gemini 2.5',
      'Neural Learning Platform': 'منصة التعلم العصبية',
      'Powered by Gemini 2.5': 'مدعومة بـ Gemini 2.5',
      '1-Click Test:': '⚡ تجربة بضغطة واحدة:',
      '⚡ 1-Click Test:': '⚡ تجربة بضغطة واحدة:',
      '1-Click Demo Login': 'تسجيل تجريبي بضغطة واحدة',
      'Sign in as Demo Student': 'تسجيل الدخول كطالب تجريبي',
      'Sign in as Demo Instructor': 'تسجيل الدخول كمعلم تجريبي',
      'Master Ambitious Tech.': 'أتقن أحدث التقنيات البرمجية.',
      'Master Ambitious Tech': 'أتقن أحدث التقنيات البرمجية',
      'Accelerate With Adaptive AI Intelligence.': 'تسارع بذكاء اصطناعي تكيفي فائق.',
      'Accelerate With': 'تسارع بـ',
      'Adaptive AI Intelligence.': 'ذكاء اصطناعي تكيفي فائق.',
      'Adaptive AI Intelligence': 'ذكاء اصطناعي تكيفي',
      'Escape tutorial purgatory. NexaLearn combines production curricula with instant AST-level code synthesis, 24/7 AI tutoring companions, and dedicated workspaces tailored for students and instructors.': 'تجاوز حلقة الدروس النظرية المفرغة. تجمع NexaLearn بين مناهج الإنتاج وتحليل الكود الفوري على مستوى شجرة الصياغة (AST)، مع مرشد ذكاء اصطناعي يعمل على مدار الساعة ومساحات عمل مخصصة للطلاب والمعلمين.',
      'Explore Courses': 'استكشف الدورات',
      'Explore courses': 'استكشف الدورات',
      'Student Hub': 'مركز الطلاب',
      'Instructor Studio': 'استوديو المدرّس',
      '50K+': '٥٠ ألف+',
      'Active builders worldwide': 'مطور نشط حول العالم',
      '99.8%': '٩٩٫٨٪',
      'AST tutoring precision': 'دقة تحليل وتوجيه الكود',
      '4.9 / 5': '٤٫٩ / ٥',
      'Learner satisfaction': 'نسبة رضا المتعلمين',
      '1,200+': '١٢٠٠+',
      'Verified learning modules': 'وحدة تعليمية معتمدة',
      'Adaptive Roadmap': 'مسار تعليمي تكيفي',
      '+42% faster retention': '+٤٢٪ سرعة في الاستيعاب',
      'nexalearn-ai-compiler · v2.5.0': 'مترجم NexaLearn الذكي · v2.5.0',
      'LIVE ENGINE': 'محرك نشط',
      'Curriculum Adapted · Diagnostic Score: 100%': 'تم تكييف المنهج · النتيجة التشخيصية: ١٠٠٪',
      'Browser Sandbox': 'بيئة برمجية في المتصفح',
      'Zero toolchain setup': 'بدون الحاجة لأي إعداد محلي',

      // Specialized Worlds (Student vs Instructor)
      'TWO SPECIALIZED WORLDS · ONE PLATFORM': 'بيئتان متخصصتان · منصة واحدة',
      'Dedicated Environments Crafted For Your Role': 'بيئات عمل مخصصة صُممت بدقة لدورك',
      'Dedicated Environments Crafted': 'بيئات مخصصة صُممت بدقة',
      'For Your Role': 'لدورك التعليمي',
      "Whether you're developing high-demand engineering skills or authoring and mentoring talent, NexaLearn gives you purposeful, role-specific tools.": 'سواء كنت تبني مهارات هندسية عالية الطلب أو تؤلف وتوجه المواهب البرمجية، تمنحك NexaLearn أدوات دقيقة مصممة خصيصاً لدورك.',
      'Student Experience': 'تجربة الطالب',
      'FOR LEARNERS': 'للمتعلمين والطلاب',
      'Master Skills With Adaptive Intelligence': 'أتقن المهارات بذكاء اصطناعي تكيفي',
      'Never get stuck with an AI tutor that adapts to your learning pace, analyzes your code syntax, and guides you through real project milestones.': 'لن تتعثر أبداً بفضل مرشد ذكاء اصطناعي يتكيف مع وتيرة تعلمك، ويحلل صياغة الكود البرمجي، ويرشدك خطوة بخطوة خلال مراحل المشاريع الحقيقية.',
      'Dynamic Roadmaps that adjust in real-time based on your quiz results and coding pace.': 'مسارات تعلم ديناميكية تتكيف فورياً وفق نتائج اختباراتك وسرعة كتابتك للأكواد.',
      'Dynamic Roadmaps': 'مسارات ديناميكية',
      '24/7 AI Code Companion offering AST inspections, algorithmic hints, and clean patterns.': 'رفيق برمجي ذكي على مدار الساعة يوفر فحص الصياغة، تلميحات خوارزمية، وأنماط كتابة كود نظيفة.',
      '24/7 AI Code Companion': 'رفيق كود ذكي على مدار الساعة',
      'Browser Code Sandbox to write and test full-stack code without local installations.': 'بيئة برمجية معزولة داخل المتصفح لكتابة واختبار تطبيقات كاملة دون الحاجة لتثبيت أي برامج.',
      'Browser Code Sandbox': 'بيئة تشغيل الأكواد في المتصفح',
      'Interactive Quizzes & Flashcards with comprehensive explanations for every question.': 'اختبارات تفاعلية وبطاقات استذكار مع شروحات تحليلية مفصلة لكل سؤال.',
      'Interactive Quizzes & Flashcards': 'اختبارات تفاعلية وبطاقات استذكار',
      'Enter Student Workspace': 'الدخول لمساحة الطالب',
      'Try Student Demo in 1 Click': '⚡ تجربة حساب الطالب بضغطة واحدة',
      '⚡ Try Student Demo in 1 Click': '⚡ تجربة حساب الطالب بضغطة واحدة',
      'Instructor Operations': 'عمليات وإدارة التدريس',
      'FOR EDUCATORS & AUTHORS': 'للمعلمين والمؤلفين',
      'Author, Mentor & Scale High-Impact Curricula': 'قم بتأليف وتوجيه مناهج عالية التأثير وتوسيع نطاقها',
      'Equip yourself with a modern teaching studio featuring AI-assisted rubric grading, live cohort telemetry, and seamless curriculum management.': 'جهّز نفسك باستوديو تدريس حديث يضم تصحيحاً مدعوماً بالذكاء الاصطناعي وفق معايير التقييم، ومؤشرات حية لدفعات الطلاب، وإدارة سلسة للمناهج.',
      'Visual Curriculum Builder with drag-and-drop syllabus structure and code prompts.': 'منشئ مناهج بصري مع هيكلة السيلابوس بنظام السحب والإفلات ومطالبات الأكواد البرمجية.',
      'Visual Curriculum Builder': 'منشئ مناهج بصري تفاعلي',
      'AI-Assisted Grading Queue reviewing submissions against rubrics with 95%+ confidence.': 'قائمة تصحيح مدعومة بالذكاء الاصطناعي لمراجعة التسليمات وفق معايير التقييم بدقة تتجاوز ٩٥٪.',
      'AI-Assisted Grading Queue': 'قائمة تصحيح بالذكاء الاصطناعي',
      'Live Cohort Roster & Analytics tracking student velocity, retention, and drop-off risks.': 'سجل تحليلات حي للدفعات يتابع وتيرة تقدم الطلاب، معدلات الاستبقاء، ومخاطر الانقطاع.',
      'Live Cohort Roster & Analytics': 'سجل تحليلات الدفعات الحية',
      'Instant Course Publishing controls with real-time catalog sync and updates.': 'أدوات نشر فوري للدورات مع مزامنة وتحديث فوري مع دليل المنصة.',
      'Instant Course Publishing': 'نشر فوري للدورات',
      'Enter Instructor Studio': 'الدخول لاستوديو التدريس',
      'Try Instructor Demo in 1 Click': '⚡ تجربة حساب المدرّس بضغطة واحدة',
      '⚡ Try Instructor Demo in 1 Click': '⚡ تجربة حساب المدرّس بضغطة واحدة',

      // AI Tutor Lab Playground
      'Live AI Tutor Sandbox': 'معمل تجربة المرشد الذكي الحي',
      'Experience the power of our AI Tutor': 'عِش قوة وإمكانيات مرشد الذكاء الاصطناعي',
      'Experience the power of our': 'عِش قوة وإمكانيات',
      'AI Tutor': 'مرشد الذكاء الاصطناعي',
      'Select any real-world technical scenario below to see how our AI Tutor breaks down concepts, generates verified code, and guides you with production best-practices.': 'اختر أي سيناريو تقني واقعي أدناه لتشاهد كيف يقوم مرشدنا الذكي بتبسيط المفاهيم، وتوليد أكواد معتمدة، وتوجيهك وفق أفضل ممارسات الإنتاج البرمجي.',
      'Angular Signals & Reactivity': 'إشارات Angular والتفاعلية الحديثة',
      'Synchronous state & zoneless architecture': 'حالة متزامنة وبنية خالية من Zone.js',
      'JavaScript Lexical Closures': 'نطاقات الإغلاق في JavaScript',
      'Memory models & functional patterns': 'نماذج الذاكرة والأنماط الوظيفية',
      'Async Exponential Backoff': 'التراجع الأسي للعمليات غير المتزامنة',
      'Resilient retry patterns with jitter': 'أنماط إعادة محاولة مرنة ومقاومة للأعطال',
      'Big-O Algorithmic Tuning': 'تحسين الكفاءة الخوارزمية (Big-O)',
      'Optimizing O(N²) down to linear O(N)': 'تقليل التعقيد من O(N²) إلى الخطي O(N)',
      'Open Full AI Tutor Session': 'فتح جلسة كاملة مع المعلم الذكي',
      'NexaLearn AI Engine · Gemini 2.5 Flash': 'محرك NexaLearn الذكي · Gemini 2.5 Flash',
      'LIVE RESPONSE': 'استجابة مباشرة حية',
      'Signals provide synchronous, fine-grained reactivity. Angular recomputes derived state only when tracked reads change, removing zone.js overhead.': 'توفر Signals تفاعلية متزامنة ودقيقة للغاية. تعيد Angular حساب الحالة المشتقة فقط عند تغير القراءات المتتبعة، مما يلغي العبء الزائد لـ zone.js.',
      'Best practice: Keep signals synchronous and pure. Use effects only for side effects like logging or external syncing.': 'أفضل ممارسة: حافظ على أن تكون الإشارات متزامنة ونقية. استخدم effects فقط للتأثيرات الجانبية مثل السجلات أو المزامنة الخارجية.',
      'JavaScript Closures & Lexical Scope': 'إغلاقات JavaScript والنطاق المعجمي',
      'A closure is created when an inner function retains access to its enclosing lexical scope even after the parent function has finished executing.': 'يتم إنشاء Closure عندما تحتفظ دالة داخلية بالوصول إلى نطاقها المعجمي المحيط حتى بعد انتهاء الدالة الرئيسية من التنفيذ.',
      'Watch out: Closures holding DOM nodes can cause memory leaks if listeners are not cleaned up on unmount.': 'انتبه: يمكن للإغلاقات التي تحتفظ بعناصر DOM أن تسبب تسرباً في الذاكرة إذا لم تتم إزالة مستمعات الأحداث عند إلغاء التركيب.',
      '5-Minute Async Backoff Challenge': 'تحدي التراجع الأسي غير المتزامن خلال ٥ دقائق',
      'Design an exponential backoff retry helper that retries an async task N times before throwing.': 'صمم دالة مساعدة للتراجع الأسي تعيد محاولة مهمة غير متزامنة N من المرات قبل إلقاء الخطأ.',
      'Tip: Add random jitter to exponential backoff to prevent thundering herd problems in microservices.': 'نصيحة: أضف تأخيراً عشوائياً (jitter) للتراجع الأسي لتجنب مشكلة هجوم القطيع المتزامن (thundering herd) في الخدمات المصغرة.',
      'Algorithmic Complexity & Optimization': 'التعقيد الخوارزمي والتحسين البرمجي',
      'Replacing an O(N²) nested array search with a Set lookup drops time complexity to linear O(N).': 'استبدال البحث في المصفوفات المتداخلة O(N²) بالبحث عبر Set يقلل التعقيد الزمني إلى التعقيد الخطي O(N).',
      'Rule of thumb: Sets and Maps provide O(1) average lookup times, saving seconds on large data arrays.': 'قاعدة ذهبية: توفر هياكل Sets و Maps وقتاً متوسطاً للبحث يبلغ O(1)، مما يوفر ثوانٍ ثمينة في مصفوفات البيانات الكبيرة.',

      // Featured Tracks
      'CAREER-ACCELERATING CURRICULA': 'مناهج لتسريع مسارك المهني',
      'Featured Learning Tracks': 'المسارات التعليمية المميزة',
      'Featured Learning': 'المسارات التعليمية',
      'Tracks': 'المسارات',
      'View all courses': 'عرض جميع الدورات',
      'TOP RATED': 'الأعلى تقييماً',
      'POPULAR': 'الأكثر طلباً',
      'NEW': 'جديد',
      'Angular 20 & Reactive Architecture': 'معمارية Angular 20 والبرمجة التفاعلية',
      'Master fine-grained signals, computed state, zoneless change detection, and SSR microfrontends.': 'أتقن إشارات Signals الدقيقة، والحالة المحسوبة، واكتشاف التغييرات بدون zone، وتطبيقات الواجهات المصغرة مع SSR.',
      'Full-Stack Node.js & Microservices': 'تطوير Node.js الشامل والخدمات المصغرة',
      'Design distributed architectures with Docker, Redis caching, event loops, and rate limiting.': 'صمم معماريات موزعة باستخدام Docker، والتخزين المؤقت عبر Redis، وحلقة الأحداث، وتقنين الطلبات.',
      'Enterprise AI Engineering with Gemini': 'هندسة الذكاء الاصطناعي للمؤسسات مع Gemini',
      'Integrate Google Gemini 2.5 Flash, multi-modal LLM reasoning, function calling, and vector embeddings.': 'دمج نموذج Google Gemini 2.5 Flash، واستدلال النماذج اللغوية متعددة الوسائط، واستدعاء الدوال، والتضمينات الشعاعية.',
      'Explore Curriculum': 'استكشف المنهج الدراسي',
      '18 hours': '١٨ ساعة',
      '14 hours': '١٤ ساعة',
      '20 hours': '٢٠ ساعة',
      '24 lessons': '٢٤ درساً',
      '15 lessons': '١٥ درساً',
      '18 lessons': '١٨ درساً',
      'Advanced': 'متقدم',
      'Intermediate': 'متوسط',
      'Beginner': 'مبتدئ',

      // Ecosystem Features
      'A COMPLETE LEARNING ECOSYSTEM': 'منظومة تعليمية متكاملة',
      'Everything You Need to Level Up': 'كل ما تحتاجه للارتقاء بمستواك البرمجي',
      'Everything You Need to': 'كل ما تحتاجه لـ',
      'Level Up': 'الارتقاء بمستواك',
      'Designed to take you from foundational understanding to production fluency through guided practice and feedback.': 'مصممة لتنقلك من الفهم التأسيسي إلى الطلاقة في بيئات الإنتاج من خلال التطبيق الموجه والتغذية الراجعة المستمرة.',
      'Adaptive Learning Paths': 'مسارات تعلم تكيفية',
      'Personalized roadmaps that evolve with your goals, knowledge gaps, and daily momentum.': 'خرائط طريق مخصصة تتطور وفق أهدافك، الفجوات المعرفية لديك، واستمرارية تعلمك اليومي.',
      '24/7 AI-Powered Tutoring': 'إرشاد ذكي على مدار الساعة',
      'Instant AST-level code diagnostics, algorithmic hints, and step-by-step conceptual breakdowns.': 'تشخيص فوري للأكواد على مستوى AST، تلميحات خوارزمية، وشروحات تدريجية للمفاهيم المعقدة.',
      'Interactive Sandbox & Code': 'مختبر كود تفاعلي متكامل',
      'Write, debug, and run code directly in your browser with real-time feedback and tests.': 'اكتب ونقح وشغّل الأكواد البرمجية مباشرة في متصفحك مع تقييم فوري واختبارات آلية.',
      'Instructor Authoring Suite': 'حزمة أدوات تأليف المناهج للمدربين',
      'Visual curriculum builder to craft modular lessons, assign hands-on challenges, and publish.': 'منشئ مناهج بصري لتصميم دروس نموذجية، وتعيين تحديات تطبيقية، والنشر بضغطة زر.',
      'AI Rubric Submissions & Grading': 'تصحيح التسليمات بمعايير ذكية',
      'Automated grading assistance with confidence scores and customizable mentor feedback.': 'مساعد تصحيح آلي مدعوم بنسب ثقة وتغذية راجعة قابلة للتخصيص من قبل المعلم.',
      'Cohort Telemetry & Insights': 'تحليلات ومؤشرات أداء الدفعات',
      'Live student velocity tracking, completion forecasts, and cohort retention metrics.': 'تتبع حي لسرعة الطلاب، توقعات نسب الإكمال، ومقاييس استبقاء المتعلمين.',

      // Testimonials
      'TRUSTED BY LEARNERS AND EDUCATORS': 'موثوق من الطلاب والمعلمين الرائدين',
      'Proven Impact Across the Entire Journey': 'أثر مثبت عبر مسيرة التعلم الكاملة',
      'Proven Impact Across the': 'أثر مثبت عبر',
      'Entire Journey': 'مسيرة التعلم الكاملة',
      '"The AI tutor felt like sitting right next to a senior staff engineer. Whenever I got stuck on async concepts, it broke the execution down step-by-step instead of just handing me the answers."': '"شعرت مع المرشد الذكي وكأنني أجلس بجوار مهندس برمجيات أول. كلما واجهت صعوبة في المفاهيم غير المتزامنة، قام بتحليل خطوات التنفيذ بدقة بدلاً من مجرد إعطائي الإجابة الجاهزة."',
      'The AI tutor felt like sitting right next to a senior staff engineer. Whenever I got stuck on async concepts, it broke the execution down step-by-step instead of just handing me the answers.': 'شعرت مع المرشد الذكي وكأنني أجلس بجوار مهندس برمجيات أول. كلما واجهت صعوبة في المفاهيم غير المتزامنة، قام بتحليل خطوات التنفيذ بدقة بدلاً من مجرد إعطائي الإجابة الجاهزة.',
      'Alex Rivera': 'أليكس ريفيرا',
      'Full-Stack Fellow · Now at Stripe': 'مهندس برمجيات شامل · يعمل حالياً لدى Stripe',
      '"As an educator, NexaLearn\'s instructor workspace cut my assignment turnaround time by 70%. The AI grading suggestions are remarkably accurate, allowing me to focus on high-touch mentorship."': '"كمعلمة، قلصت مساحة عمل المدرب في NexaLearn وقت مراجعة الواجبات بنسبة ٧٠٪. اقتراحات التصحيح بالذكاء الاصطناعي دقيقة للغاية، مما أتاح لي التركيز على التوجيه المباشر للطلاب."',
      "As an educator, NexaLearn's instructor workspace cut my assignment turnaround time by 70%. The AI grading suggestions are remarkably accurate, allowing me to focus on high-touch mentorship.": 'كمعلمة، قلصت مساحة عمل المدرب في NexaLearn وقت مراجعة الواجبات بنسبة ٧٠٪. اقتراحات التصحيح بالذكاء الاصطناعي دقيقة للغاية، مما أتاح لي التركيز على التوجيه المباشر للطلاب.',
      'Dr. Elena Vance': 'د. إلينا فانس',
      'Lead AI Educator · 4,200+ Students Mentored': 'كبيرة مدربي الذكاء الاصطناعي · أشرفت على تدريب أكثر من ٤٢٠٠ طالب',

      // FAQ Accordion
      'CLEAR ANSWERS TO COMMON QUESTIONS': 'إجابات واضحة للأسئلة الشائعة',
      'Frequently Asked Questions': 'الأسئلة الشائعة',
      'Frequently Asked': 'الأسئلة الشائعة',
      'Everything you need to know about getting started, our AI companion, and course authoring.': 'كل ما تحتاج معرفته حول البداية، رفيق الذكاء الاصطناعي، وتأليف الدورات التعليمية.',
      'How does the AI Tutor differ from standard chatbot responses?': 'كيف يختلف مرشد الذكاء الاصطناعي عن روبوتات الدردشة التقليدية؟',
      'Unlike generic LLMs, NexaLearn’s AI Tutor is context-aware: it understands your exact course progress, performs AST (Abstract Syntax Tree) code inspections, and guides you through socratic hints and diagnostics rather than dumping raw answers.': 'على عكس نماذج الذكاء الاصطناعي العامة، يدرك مرشد NexaLearn سياقك التعليمي بدقة: فهو يستوعب تقدمك في الدورة، ويفحص كودك على مستوى شجرة الصياغة (AST)، ويرشدك بأسلوب سقراطي وتلميحات تشخيصية بدلاً من الاكتفاء بإلقاء الإجابات الجاهزة.',
      'Unlike generic LLMs, NexaLearn\'s AI Tutor is context-aware: it understands your exact course progress, performs AST (Abstract Syntax Tree) code inspections, and guides you through socratic hints and diagnostics rather than dumping raw answers.': 'على عكس نماذج الذكاء الاصطناعي العامة، يدرك مرشد NexaLearn سياقك التعليمي بدقة: فهو يستوعب تقدمك في الدورة، ويفحص كودك على مستوى شجرة الصياغة (AST)، ويرشدك بأسلوب سقراطي وتلميحات تشخيصية بدلاً من الاكتفاء بإلقاء الإجابات الجاهزة.',
      'Can I jump between the Student Learning Hub and Instructor Studio?': 'هل يمكنني التبديل بين مركز تعلم الطلاب واستوديو المدرب؟',
      'Yes! NexaLearn supports specialized roles. Students get adaptive roadmaps and instant code sandboxes, while instructors get an AI-assisted curriculum builder, automated rubric grading, and cohort telemetry. You can test both with 1-click in the top bar.': 'نعم! تدعم NexaLearn أدواراً متخصصة. يحصل الطلاب على مسارات تكيفية وبيئات كود معزولة، بينما يحصل المعلمون على منشئ مناهج ذكي وتصحيح آلي بمعايير تقييم وتحليلات للدفعة. يمكنك تجربة الدورين بضغطة زر واحدة في الشريط العلوي.',
      'Are the practice challenges and projects runnable in the browser?': 'هل التحديات والمشاريع التطبيقية قابلة للتشغيل في المتصفح؟',
      'Absolutely. Every lesson includes interactive web sandboxes and code playgrounds. You don’t need to configure local toolchains, Docker, or compilers to build production-grade projects.': 'بالتأكيد. يتضمن كل درس بيئات برمجية ويب تفاعلية ومختبرات كود. لن تحتاج إلى إعداد بيئات عمل محلية أو Docker أو برامج ترجمة لبناء مشاريع تحاكي بيئات العمل الحقيقية.',
      'Absolutely. Every lesson includes interactive web sandboxes and code playgrounds. You don\'t need to configure local toolchains, Docker, or compilers to build production-grade projects.': 'بالتأكيد. يتضمن كل درس بيئات برمجية ويب تفاعلية ومختبرات كود. لن تحتاج إلى إعداد بيئات عمل محلية أو Docker أو برامج ترجمة لبناء مشاريع تحاكي بيئات العمل الحقيقية.',
      'What AI model powers NexaLearn’s intelligence engine?': 'ما هو نموذج الذكاء الاصطناعي الذي يدير محرك NexaLearn؟',
      'What AI model powers NexaLearn\'s intelligence engine?': 'ما هو نموذج الذكاء الاصطناعي الذي يدير محرك NexaLearn؟',
      'NexaLearn is backed by Google Gemini 2.5 Flash, providing lightning-fast multimodal reasoning, code synthesis, and realtime explanation breakdowns with sub-second latency.': 'تعتمد NexaLearn على نموذج Google Gemini 2.5 Flash، مما يوفر استدلالاً سريعاً متعدد الوسائط، وتوليداً للأكواد، وشروحات تفصيلية في أجزاء من الثانية.',
      'Is there a free tier to test the platform before committing?': 'هل تتوفر باقة مجانية لتجربة المنصة قبل الاشتراك؟',
      'Yes, full free access is provided to sample modules, the interactive AI Tutor playground, and the course catalog. Click "Student Demo" or "Instructor Demo" to experience the platform instantly.': 'نعم، يتوفر وصول مجاني كامل لوحدات نموذجية، ولمعمل تجربة المعلم الذكي التفاعلي، ولدليل الدورات. اضغط على "تجربة الطالب" أو "تجربة المدرّس" لتجربة المنصة فورياً.',

      // Closing CTA Banner
      'Start mastering technology with AI guidance today': 'ابدأ في إتقان التكنولوجيا بإرشاد الذكاء الاصطناعي اليوم',
      'AI guidance': 'إرشاد الذكاء الاصطناعي',
      'Join thousands of students building real skills, or empower your students with our advanced instructor workspace.': 'انضم إلى آلاف الطلاب الذين يبنون مهارات حقيقية، أو مكّن طلابك باستخدام مساحة عمل المدرب المتقدمة لدينا.',
      'Create Free Account': 'إنشاء حساب مجاني',
      'Browse All Courses': 'تصفح جميع الدورات',

      // Navbar & Navigation
      'Learning Paths': 'مسارات التعلم',
      'AI Studio': 'استوديو الذكاء الاصطناعي',
      'About Platform': 'عن المنصة',
      'Instructor Hub': 'مركز المدرّس',
      'AI Tutor Lab': 'معمل المعلم الذكي',
      'Quiz Engine': 'محرك الاختبارات الذكي',
      'Code Explainer': 'مفسر ومحلل الأكواد',
      'Interactive coding tutor with contextual hints': 'معلم برمجة تفاعلي يقدم تلميحات سياقية ذكية',
      'Auto-generate quizzes from any concept': 'توليد اختبارات تلقائية من أي مفهوم برمجياً',
      'Instant line-by-line reasoning and reviews': 'تحليل وشرح فوري سطر بسطر ومراجعة الكود',
      'Quick Demo:': 'تجربة سريعة:',
      'Student Demo': 'تجربة الطالب',
      'Teacher Demo': 'تجربة المدرّس',
      'Go to Dashboard': 'الانتقال للوحة التحكم',
      'My Learning': 'تعلمي',
      'Sign Out': 'تسجيل الخروج',
      'Signing out…': 'جاري تسجيل الخروج…',
      'Sign In': 'تسجيل الدخول',
      'Get Started': 'ابدأ الآن',
      'Dashboard': 'لوحة التحكم',
      'My Enrolled Courses': 'دوراتي المسجل بها',
      'Learning Roadmap': 'خريطة طريق التعلم',
      'Assignments': 'الواجبات والتكليفات',
      'Progress Analytics': 'تحليلات التقدم',
      'Curriculum Builder': 'منشئ المناهج',
      'Admin Governance': 'إدارة وحوكمة المنصة',
      'AI Tutor Companion': 'رفيق المعلم الذكي',
      'Switch language': 'تبديل اللغة',
      'Switch language to English': 'تبديل اللغة إلى الإنجليزية',
      'Switch language to العربية': 'تبديل اللغة إلى العربية',

      // Footer
      'Next-generation adaptive learning platform powered by deep artificial intelligence, interactive code sandboxes, and personalized mastery roadmaps.': 'منصة تعلم تكيفية من الجيل القادم مدعومة بذكاء اصطناعي عميق، ومختبرات كود تفاعلية، وخرائط طريق مخصصة لتحقيق الإتقان.',
      'Product': 'المنتج',
      'Roles & Access': 'الأدوار والوصول',
      'Resources': 'المصادر والتعلم',
      'Legal & Trust': 'الأمان والخصوصية',
      'Privacy Policy': 'سياسة الخصوصية',
      'Terms of Service': 'شروط الخدمة',
      'Security Whitepaper': 'وثيقة الأمان والامتثال',
      'Compliance': 'معايير الامتثال',
      'API Status': 'حالة واجهة البرمجة',
      'Documentation': 'التوثيق الفني',
      'Community Forum': 'منتدى المجتمع البرمجي',
      'Research Papers': 'الأوراق البحثية',
      'System Status': 'حالة النظام التشغيلية',
      'Operational': 'تشغيلي بالكامل',
      'Operational 100%': 'تشغيلي ١٠٠٪',
      'Gemini 2.5 Engine': 'محرك Gemini 2.5',
      'Gemini 2.5 Engine: Operational 100%': 'محرك Gemini 2.5: تشغيلي بنسبة ١٠٠٪',
      "All rights reserved. Built with precision for tomorrow's technology leaders.": 'جميع الحقوق محفوظة. صُنعت بدقة لقادة التكنولوجيا المستقبليين.',
      'All rights reserved. Built with precision for tomorrow’s technology leaders.': 'جميع الحقوق محفوظة. صُنعت بدقة لقادة التكنولوجيا المستقبليين.',
      'Gemini 2.5 Active': 'Gemini 2.5 نشط',
      'Search courses, lessons, AI tools...': 'ابحث عن الدورات والدروس وأدوات الذكاء الاصطناعي...',
      'Global search': 'البحث الشامل',
      'AI Model Active: Google Gemini 2.5 Flash': 'نموذج الذكاء الاصطناعي نشط: Google Gemini 2.5 Flash',
      'Open AI Studio': 'فتح استوديو الذكاء الاصطناعي',
      'Draft syllabus modules, generate quizzes, or review code with Gemini.': 'صمم وحدات المنهج، وأنشئ الاختبارات، أو راجع الأكواد باستخدام Gemini.',
      'Open Curriculum Builder': 'فتح منشئ المناهج',
      'AI Platform Tools': 'أدوات منصة الذكاء الاصطناعي',
    }
  );

  private readonly reverseTranslations = Object.entries(this.translations).reduce<Record<string, string>>(
    (reverse, [english, arabic]) => {
      reverse[arabic] ??= english;
      return reverse;
    },
    {},
  );

  constructor() {
    afterNextRender(() => {
      window.setTimeout(() => {
        const savedLocale = window.localStorage.getItem('nexalearn-language');
        if (savedLocale === 'en' || savedLocale === 'ar') {
          this.currentLocale = savedLocale;
          this.localeSubject.next(savedLocale);
        }
        this.applyTranslations();
      });
    });
  }

  setLanguage(lang: LanguageCode): void {
    this.currentLocale = lang;
    this.localeSubject.next(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nexalearn-language', lang);
    }
    this.applyTranslations();
  }

  toggleLanguage(): void {
    this.setLanguage(this.currentLocale === 'en' ? 'ar' : 'en');
  }

  get currentLanguage(): LanguageCode {
    return this.currentLocale;
  }

  isArabic(): boolean {
    return this.currentLocale === 'ar';
  }

  translate(key: string): string {
    const map = this.currentLocale === 'ar' ? this.translations : this.reverseTranslations;
    return map[key] ?? key;
  }

  private isTranslating = false;

  applyTranslations(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const body = document.body;
    if (!body) {
      return;
    }

    const isRtl = this.currentLocale === 'ar';
    document.documentElement.lang = this.currentLocale;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    body.dir = isRtl ? 'rtl' : 'ltr';

    document.documentElement.classList.toggle('rtl-mode', isRtl);
    document.documentElement.classList.toggle('ltr-mode', !isRtl);
    body.classList.toggle('rtl-mode', isRtl);
    body.classList.toggle('ltr-mode', !isRtl);

    this.translateTree(body);

    if (!this.observer && typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver((records) => {
        if (this.isTranslating) {
          return;
        }
        for (const record of records) {
          if (record.type === 'characterData' && record.target instanceof Text) {
            if (this.currentLocale === 'ar') {
              const current = record.target.textContent ?? '';
              const original = this.originalText.get(record.target);
              const translated = original ? this.translationFor(original, 'ar') : undefined;
              if (current !== translated) {
                if (!/[\u0600-\u06FF]/.test(current)) {
                  this.originalText.set(record.target, current);
                }
                this.translateTextNode(record.target);
              }
            } else {
              const current = record.target.textContent ?? '';
              if (!/[\u0600-\u06FF]/.test(current)) {
                this.originalText.set(record.target, current);
              }
            }
          }
          for (const addedNode of record.addedNodes) {
            if (addedNode instanceof Element) {
              this.translateTree(addedNode);
            } else if (addedNode instanceof Text) {
              this.translateTextNode(addedNode);
            }
          }
          if (record.type === 'attributes' && record.target instanceof Element && record.attributeName) {
            this.translateAttribute(record.target, record.attributeName);
          }
        }
      });
      this.observer.observe(body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-label', 'placeholder', 'title'],
      });
    }
  }

  private translateTree(root: Element): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node instanceof Text) {
        this.translateTextNode(node);
      }
      node = walker.nextNode();
    }

    if (root.matches('[aria-label], [placeholder], [title]')) {
      this.translateElementAttributes(root);
    }
    root.querySelectorAll('[aria-label], [placeholder], [title]').forEach((element) => {
      this.translateElementAttributes(element);
    });
  }

  private translateTextNode(node: Text): void {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, code, pre, .material-symbols-outlined, [dir="ltr"]')) {
      return;
    }

    const currentText = node.textContent ?? '';

    if (this.currentLocale === 'en') {
      let originalEn = this.originalText.get(node);
      if (originalEn && /[\u0600-\u06FF]/.test(originalEn)) {
        originalEn = this.translationFor(originalEn, 'en') ?? originalEn;
        this.originalText.set(node, originalEn);
      }

      if (originalEn !== undefined) {
        if (node.textContent !== originalEn) {
          this.isTranslating = true;
          try {
            node.textContent = originalEn;
          } finally {
            this.isTranslating = false;
          }
        }
      } else if (/[\u0600-\u06FF]/.test(currentText)) {
        const backToEn = this.translationFor(currentText, 'en');
        if (backToEn && node.textContent !== backToEn) {
          this.isTranslating = true;
          try {
            node.textContent = backToEn;
          } finally {
            this.isTranslating = false;
          }
          this.originalText.set(node, backToEn);
        }
      } else {
        this.originalText.set(node, currentText);
      }
      return;
    }

    // Locale is 'ar'
    if (!this.originalText.has(node) && !/[\u0600-\u06FF]/.test(currentText)) {
      this.originalText.set(node, currentText);
    }

    const source = this.originalText.get(node) ?? currentText;
    const arabic = this.translationFor(source, 'ar');
    if (arabic !== undefined && node.textContent !== arabic) {
      this.isTranslating = true;
      try {
        node.textContent = arabic;
      } finally {
        this.isTranslating = false;
      }
    }
  }

  private translateElementAttributes(element: Element): void {
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      this.translateAttribute(element, attribute);
    }
  }

  private translateAttribute(element: Element, attribute: string): void {
    const currentVal = element.getAttribute(attribute);
    if (currentVal === null) {
      return;
    }

    let originals = this.originalAttributes.get(element);
    if (!originals) {
      originals = new Map<string, string>();
      this.originalAttributes.set(element, originals);
    }

    if (this.currentLocale === 'en') {
      let originalEn = originals.get(attribute);
      if (originalEn && /[\u0600-\u06FF]/.test(originalEn)) {
        originalEn = this.translationFor(originalEn, 'en') ?? originalEn;
        originals.set(attribute, originalEn);
      }

      if (originalEn !== undefined) {
        if (currentVal !== originalEn) {
          this.isTranslating = true;
          try {
            element.setAttribute(attribute, originalEn);
          } finally {
            this.isTranslating = false;
          }
        }
      } else if (/[\u0600-\u06FF]/.test(currentVal)) {
        const backToEn = this.translationFor(currentVal, 'en');
        if (backToEn && currentVal !== backToEn) {
          this.isTranslating = true;
          try {
            element.setAttribute(attribute, backToEn);
          } finally {
            this.isTranslating = false;
          }
          originals.set(attribute, backToEn);
        }
      } else {
        originals.set(attribute, currentVal);
      }
      return;
    }

    // Locale is 'ar'
    if (!originals.has(attribute) && !/[\u0600-\u06FF]/.test(currentVal)) {
      originals.set(attribute, currentVal);
    }

    const source = originals.get(attribute) ?? currentVal;
    const arabic = this.translationFor(source, 'ar');
    if (arabic !== undefined && currentVal !== arabic) {
      this.isTranslating = true;
      try {
        element.setAttribute(attribute, arabic);
      } finally {
        this.isTranslating = false;
      }
    }
  }

  private translationFor(original: string, lang: LanguageCode = this.currentLocale): string | undefined {
    const map = lang === 'ar' ? this.translations : this.reverseTranslations;
    let translated = original;
    let changed = false;
    const entries = Object.entries(map).sort(([left], [right]) => right.length - left.length);
    for (const [source, target] of entries) {
      if (/^[A-Za-z0-9_-]+$/.test(source)) {
        const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordPattern = new RegExp(`\\b${escapedSource}\\b`, 'g');
        if (wordPattern.test(translated)) {
          translated = translated.replace(wordPattern, target);
          changed = true;
        }
      } else if (translated.includes(source)) {
        translated = translated.replaceAll(source, target);
        changed = true;
      }
    }

    if (!changed) {
      return undefined;
    }
    return translated;
  }
}
