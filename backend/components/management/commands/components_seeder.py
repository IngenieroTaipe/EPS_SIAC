from django.core.management.base import BaseCommand
from django.db import transaction
from components.models import Component, ComponentType, ComponentCategory, ComponentStatus
 