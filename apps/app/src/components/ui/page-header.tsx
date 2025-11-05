import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { ArrowLeft, Menu } from "lucide-react"
import { Flex } from "./flex"
import { MutedText } from "./muted-text"
import { useMobileMenu } from "../Layout"

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onBack?: () => void
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  icon,
  onBack,
  actions,
  className
}: PageHeaderProps) {
  const mobileMenu = useMobileMenu();

  return (
    <header className={cn("bg-background border-b border-border flex-none", className)}>
      <div className="flex items-center justify-between p-3 sm:p-4 md:p-6">
        <Flex gap="2" className="gap-2 sm:gap-3">
          {/* Burger Menu - Mobile uniquement, à gauche de tout */}
          <Button
            variant="ghost"
            size="icon"
            onClick={mobileMenu.toggle}
            className="h-8 w-8 sm:h-9 sm:w-9 md:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 sm:h-9 sm:w-9"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}

          {icon ? (
            <Flex gap="2" className="gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-secondary/50">
                <div className="text-secondary-foreground">
                  {icon}
                </div>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground">
                  {title}
                </h1>
                {subtitle && (
                  <MutedText size="sm" className="hidden sm:block">
                    {subtitle}
                  </MutedText>
                )}
              </div>
            </Flex>
          ) : (
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">{title}</h1>
              {subtitle && (
                <MutedText size="sm" className="hidden sm:block">
                  {subtitle}
                </MutedText>
              )}
            </div>
          )}
        </Flex>

        {actions && (
          <Flex gap="2" className="gap-1.5 sm:gap-2">
            {actions}
          </Flex>
        )}
      </div>
    </header>
  )
}
