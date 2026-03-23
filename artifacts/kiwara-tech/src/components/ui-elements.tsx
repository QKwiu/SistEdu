import { forwardRef } from "react";
import { cn } from "./layout";

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:bg-primary/95",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border-2 border-slate-200 text-slate-700 hover:border-primary hover:text-primary bg-transparent",
      ghost: "hover:bg-slate-100 text-slate-700 hover:text-slate-900",
      accent: "bg-accent text-white shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 hover:bg-accent/95",
    };
    
    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-sm font-medium",
      lg: "px-8 py-4 text-base font-semibold",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Card = ({ className, children }: { className?: string, children: React.ReactNode }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 md:p-8", className)}>
    {children}
  </div>
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:bg-slate-50",
            error && "border-destructive focus:ring-destructive/15 focus:border-destructive",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-destructive font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
