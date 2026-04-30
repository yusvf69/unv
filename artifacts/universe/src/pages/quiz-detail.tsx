import { useState } from "react";
import { useGetQuiz, useSubmitQuiz, getGetQuizQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronLeft, CheckCircle2, XCircle } from "lucide-react";

interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
  pointsAwarded: number;
  correctCount: number;
  questionCount: number;
  breakdown?: { questionId: number; correct: boolean; correctIndex: number; explanation: string }[];
}

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const quizId = Number(id);
  const { data: quiz, isLoading } = useGetQuiz(quizId, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId) }
  });
  const submitQuiz = useSubmitQuiz();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!quiz) return <div className="p-8 text-center">Not found</div>;

  const handleAnswer = (questionId: number, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleNext = () => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    const payload = {
      answers: Object.entries(answers).map(([qId, sIdx]) => ({
        questionId: Number(qId),
        selectedIndex: sIdx
      }))
    };
    
    submitQuiz.mutate(
      { id: quizId, data: payload },
      { onSuccess: (data) => setResult(data) }
    );
  };

  if (result) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-bold text-primary">{Math.round((result.correctCount / result.questionCount) * 100)}%</span>
          </div>
          <h1 className="text-4xl font-serif font-bold mb-4">Quiz Completed!</h1>
          <p className="text-lg text-muted-foreground mb-2">You earned <span className="font-bold text-accent">{result.pointsEarned}</span> points</p>
          <Link href="/quizzes">
            <Button variant="outline" className="mt-4">Back to Quizzes</Button>
          </Link>
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-bold mb-6 border-b pb-2">Review Answers</h3>
          {result.breakdown.map((item: any, index: number) => {
            const question = quiz.questions.find(q => q.id === item.questionId);
            if (!question) return null;
            
            const userAnswerIdx = answers[item.questionId];
            
            return (
              <div key={item.questionId} className={`p-6 rounded-2xl border ${item.correct ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex gap-4">
                  <div className="shrink-0 mt-1">
                    {item.correct ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg mb-4">{index + 1}. {question.text}</h4>
                    <div className="space-y-2 mb-4">
                      {question.options.map((opt, oIdx) => {
                        let className = "p-3 rounded-lg border text-sm ";
                        if (oIdx === item.correctIndex) {
                          className += "border-green-500 bg-green-500/10 font-medium";
                        } else if (oIdx === userAnswerIdx && !item.correct) {
                          className += "border-destructive bg-destructive/10";
                        } else {
                          className += "border-border bg-background opacity-50";
                        }
                        return <div key={oIdx} className={className}>{opt}</div>;
                      })}
                    </div>
                    <div className="text-sm bg-background/50 p-4 rounded-xl text-muted-foreground border border-border/50">
                      <strong>Explanation:</strong> {item.explanation}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentIndex];
  const progress = ((currentIndex) / quiz.questions.length) * 100;
  const isLast = currentIndex === quiz.questions.length - 1;
  const canSubmit = Object.keys(answers).length === quiz.questions.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="mb-8">
        <Link href="/quizzes" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Exit Quiz
        </Link>
        <h1 className="text-2xl font-serif font-bold mb-4">{quiz.title}</h1>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentIndex + 1} of {quiz.questions.length}</span>
          <span>{Math.round(progress)}% Completed</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-card p-8 rounded-3xl shadow-sm border border-border">
          <h2 className="text-2xl font-bold mb-8 leading-snug">{question.text}</h2>
          
          <RadioGroup 
            value={answers[question.id]?.toString() || ""} 
            onValueChange={(val) => handleAnswer(question.id, parseInt(val))}
            className="space-y-3"
          >
            {question.options.map((opt, idx) => (
              <div key={idx} className={`flex items-center space-x-3 p-4 rounded-xl border transition-colors ${answers[question.id] === idx ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value={idx.toString()} id={`q${question.id}-o${idx}`} className="ml-2" />
                <Label htmlFor={`q${question.id}-o${idx}`} className="flex-1 cursor-pointer text-base leading-relaxed py-1">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center bg-card p-4 rounded-2xl border border-border shadow-sm">
        <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Previous
        </Button>
        
        {isLast ? (
          <Button onClick={handleSubmit} disabled={!canSubmit || submitQuiz.isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground px-8">
            {submitQuiz.isPending ? "Submitting..." : "Submit Quiz"}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={answers[question.id] === undefined}>
            Next <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
